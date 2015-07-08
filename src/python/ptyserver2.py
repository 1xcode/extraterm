#
#
#
import ptyprocess
import select
import sys
import struct
import fcntl
import os
import codecs
import array
import threading
import json

def processPacket(byte_data):
    """
    byte_data - String of bytes containing JSON data in utf-8 encoding.
    """
    json_data = codecs.decode(byte_data, 'utf-8')
    sendToMaster(json_data)

def sendToMaster(data):
    print(data)
    sys.stdout.flush()

def log(msg):
    print(msg, file=sys.stderr)
    sys.stderr.flush()

###########################################################################
activity_event = threading.Event()
nbfr_counter = 0

class NonblockingFileReader:
    def __init__(self, file_object=None, read=None):
        global nbfr_counter
        
        self.file_object = file_object
        self._custom_read = read
        
        self.id = nbfr_counter
        nbfr_counter += 1
        
        self._isEOF = False
        
        self.buffer = []
        self.buffer_lock = threading.Lock()
        
        self.thread = threading.Thread(name="Nonblocking File Reader "+str(self.id),
            target=self._thread_start)
        self.thread.daemon = True
        self.thread.start()

    def read(self):
        with self.buffer_lock:
            if len(self.buffer) != 0:
                chunk = self.buffer[0]
                del self.buffer[0]
                return chunk
            else:
                return None

    def isAvailable(self):
        with self.buffer_lock:
            return len(self.buffer) != 0

    def isEOF(self):
        with self.buffer_lock:
            return len(self.buffer)==0 and self._isEOF

    def _thread_start(self):
        global activity_event
        try:
            while True:
                chunk = self._read_next()
                # log("_thread_start read:" + repr(chunk))
                with self.buffer_lock:
                    self.buffer.append(chunk)
                # Tick the alarm
                log("reading setting flag!")
                activity_event.set()
        except EOFError:
            self._isEOF = True
            log("NonblockingFileReader got EOF, bye!")
            activity_event.set()
            
    def _read_next(self):
        if self._custom_read is not None:
            return self._custom_read(1024)
        else:
            return self.file_object.read(10240)

class NonblockingLineReader(NonblockingFileReader):
    def _read_next(self):
        return self.file_object.readline()

def WaitOnIOActivity():
    global activity_event
    # log("activity_event.wait()")
    activity_event.wait()
    # log("activity_event.clear()")
    activity_event.clear()

###########################################################################

pty_list = []   # List of dicts with structure {id: string, pty: pty, reader: }

#
#
# Create pty command (from Extraterm process):
# {
#   type: string = "create";
#   argv: string[];
#   rows: number;
#   columns: number;
# }
#
# Created message (to Extraterm process):
# {
#   type: string = "created";
#   id: string; // pty ID.
# }
#
#
# pty output message (to Extraterm process):
# {
#   type: string = "output";
#   id: number; // pty ID.
#   data: string;
# }
#
# pty closed message (to Extraterm process):
# {
#   type: string = "closed";
#   id: number; // pty ID.
# }
#
# write to pty message (from Extraterm process)
# {
#   type: string = "write";
#   id: number; // pty ID.
#   data: string;
# }
#
# resize message (from Extraterm process)
# {
#   type: string = "resize";
#   id: number; // pty ID.
#   rows: number;
#   columns: number;
# }
#
# terminate (from Extraterm process)
# {
#   type: string = "terminate";
# }
#
pty_counter = 1

def process_command(json_command):
    global pty_list
    global pty_counter
    
    log("server process command:"+repr(json_command))
    cmd = json.loads(json_command)
    if cmd["type"] == "create":
        # Create a new pty.
        rows = cmd["rows"]
        columns = cmd["columns"]
        pty = ptyprocess.PtyProcess.spawn(cmd["argv"], dimensions=(rows, columns) ) #cwd=, env=, )
        pty_reader = NonblockingFileReader(read=pty.read)
        pty_id = pty_counter
        pty_list.append( { "id": pty_id, "pty": pty, "reader": pty_reader } )
        pty_counter += 1
        
        send_to_controller({ "type": "created", "id": pty_id })
        return True
        
    if cmd["type"] == "write":
        pty = find_pty_by_id(cmd["id"])
        if pty is None:
            log("Received a write command for an unknown pty (id=" + str(cmd["id"]) + "")
            return
        pty.write(cmd["data"].encode())
        return True

    if cmd["type"] == "resize":
        pty = find_pty_by_id(cmd["id"])
        if pty is None:
            log("Received a resizee command for an unknown pty (id=" + str(cmd["id"]) + "")
            return
        pty.setwinsize(cmd["rows"], cmd["columns"])
        return True
        
    if cmd["type"] == "terminate":
        for pty_tup in pty_list:
            pty_tup["pty"].terminate(True)
        return False
        
    log("ptyserver receive unrecognized message:" + json_command)
    return True
    
def send_to_controller(msg):
    msg_text = json.dumps(msg)+"\n"
    log("server >>> main : "+msg_text)
    sys.stdout.write(msg_text)
    sys.stdout.flush()

def find_pty_by_id(pty_id):
    for pty_tup in pty_list:
        if pty_tup["id"] == pty_id:
            return pty_tup["pty"]
    return None

def main():
    global pty_list
    running = True
    
    log("pty server process starting up")
    stdin_reader = NonblockingLineReader(sys.stdin)
    
    while running:
        log("pty server active count: " + str(threading.active_count()))
        WaitOnIOActivity()
        log("Server awake")
        
        # Check the stdin control channel.
        if stdin_reader.isEOF():
            log("server <<< main : EOF")
            running = False
            
        chunk = stdin_reader.read()
        while chunk is not None:
            log("server <<< main : " + repr(chunk))
            running = False if not running or not process_command(chunk.strip()) else True
            log("running: " + str(running))
            chunk = stdin_reader.read()
            
        # Check our ptys for output.
        for pty_struct in pty_list:
            pty_chunk = pty_struct["reader"].read()
            while pty_chunk is not None:
                log("server <<< pty : " + repr(pty_chunk))
                # Decode the chunk of bytes.
                data = pty_chunk.decode(errors='ignore')
                send_to_controller( {"type": "output", "id": pty_struct["id"], "data": data} )
                pty_chunk = pty_struct["reader"].read()

        # Check for exited ptys
        for pty_struct in pty_list[:]:
            log("checking live pty: "+str(pty_struct["pty"].isalive()))
            if not pty_struct["pty"].isalive():
                pty_list = [ t for t in pty_list if t["id"] != pty_struct["id"] ]
                send_to_controller( {"type": "closed", "id": pty_struct["id"] } )
        log("pty server active count: " + str(threading.active_count()))
        for t in threading.enumerate():
            log("Thread: " + t.name)

    sys.stdin.buffer.raw.close()
    log("pty server main thread exiting.")
    sys.exit(0)
main()
