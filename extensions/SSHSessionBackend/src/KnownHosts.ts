/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import * as crypto from "node:crypto";
import * as ssh2 from "ssh2";
import { HostPattern } from "./HostPattern";

export type KnownHostsLineType = "host" | "hash" | "comment" | "revoked" | "cert-authority";


export interface KnownHostsLineBase {
  type: KnownHostsLineType;
  rawLine: string;
}

export interface KnownHostsLineComment extends KnownHostsLineBase {
  type: "comment" | "cert-authority";
  rawLine: string;
}

export interface KnownHostsLineHost extends KnownHostsLineBase {
  type: "host";
  algo: string;
  hostPattern: string;
  publicKeyB64: string;
}

export interface KnownHostsLineHash extends KnownHostsLineBase {
  type: "hash";
  algo: string;
  hostHash: string;
  publicKeyB64: string;
}

export interface KnownHostsLineRevoked extends KnownHostsLineBase {
  type: "revoked",
  algo: string;
  publicKeyB64: string;
}

export type KnownHostsLine = KnownHostsLineHost | KnownHostsLineHash | KnownHostsLineComment | KnownHostsLineRevoked;

export enum VerifyResultCode {
  OK,
  UNKNOWN,
  CHANGED,
  REVOKED
};

export interface VerifyResult {
  result: VerifyResultCode;
  line?: number;
  publicKey?: Buffer;
}

export class KnownHosts {

  lines: KnownHostsLine[] = [];

  constructor() {
  }

  loadString(knownHostsString: string): void {
    const lines = knownHostsString.split("\n");
    this.lines = lines.map(line => this.#parseLine(line));
  }

  #parseLine(line: string): KnownHostsLine {
    if (line.startsWith("#") || line.trim() === "") {
      return {
        type: "comment",
        rawLine: line
      };
    }

    if (line.startsWith("@revoked")) {
      const parts = line.split(" ").filter(part => part.trim() !== "");
      if (parts.length < 4) {
        return {
          type: "comment",
          rawLine: line
        };
      }

      const result: KnownHostsLineRevoked ={
        type: "revoked",
        algo: parts[2],
        publicKeyB64: parts[3],
        rawLine: line
      };
      return result;
    }

    if (line.startsWith("@cert-authority")) {
      return {
        type: "cert-authority",
        rawLine: line
      };
    }

    const parts = line.split(" ").filter(part => part.trim() !== "");
    if (parts.length < 3) {
      return {
        type: "comment",
        rawLine: line
      };
    }

    if (parts[0].startsWith("|")) {
      const hashLine: KnownHostsLineHash = {
        type: "hash",
        hostHash: parts[0],
        algo: parts[1],
        publicKeyB64: parts[2],
        rawLine: line
      };
      return hashLine;
    }

    const hostLine: KnownHostsLineHost = {
      type: "host",
      hostPattern: parts[0],
      algo: parts[1],
      publicKeyB64: parts[2],
      rawLine: line
    };
    return hostLine;
  }

  verify(hostname: string, remoteKeys: ssh2.ParsedKey[]): VerifyResult {
    const revokeResult = this.#isPublicKeyRevoked(remoteKeys);
    if (revokeResult != null) {
      return revokeResult;
    }

    for (let i=0; i<this.lines.length; i++) {
      const line = this.lines[i];
      if (line.type === "host") {
        if (this.#matchHostPattern(hostname, line)) {
          const result = this.#verifyPublicKeys(line, remoteKeys);
          result.line = i;
          return result;
        }
      } else if (line.type === "hash") {
        if (this.#matchHostHash(hostname, line)) {
          const result = this.#verifyPublicKeys(line, remoteKeys);
          result.line = i;
          return result;
        }
      }
    }

    return {
      result: VerifyResultCode.UNKNOWN
    };
  }

  #isPublicKeyRevoked(remoteKeys: ssh2.ParsedKey[]): VerifyResult {
    for (let i=0; i<this.lines.length; i++) {
      const line = this.lines[i];
      if (line.type === "revoked") {
        const lineKey = Buffer.from(line.publicKeyB64, "base64");
        for (const key of remoteKeys) {
          if (key.equals(lineKey)) {
            return {
              result: VerifyResultCode.REVOKED,
              line: i,
              publicKey: lineKey
            };
          }
        }
      }
    }
    return null;
  }

  #matchHostPattern(hostname: string, line: KnownHostsLineHost): boolean {
    const hostPatterns = line.hostPattern.split(",").map(hp => new HostPattern(hp));

    for (const pattern of hostPatterns) {
      if (pattern.isNegative() && pattern.match(hostname)) {
        return false;
      }
    }

    for (const pattern of hostPatterns) {
      if (!pattern.isNegative() && pattern.match(hostname)) {
        return true;
      }
    }
    return false;
  }

  #matchHostHash(hostname: string, line: KnownHostsLineHash): boolean {
    const parts = line.hostHash.split("|");
    const salt = Buffer.from(parts[2], "base64");
    const lineHost = Buffer.from(parts[3], "base64");
    const hostHash = this.#hashHost(hostname, salt);
    return lineHost.equals(hostHash);
  }

  #hashHost(hostname: string, salt: Buffer): Buffer {
    const hmac = crypto.createHmac("sha1", salt);
    hmac.update(Buffer.from(hostname, "utf8"));
    const digest = hmac.digest();
    hmac.end();
    return digest;
  }

  #verifyPublicKeys(line: KnownHostsLineHost | KnownHostsLineHash, remoteKeys: ssh2.ParsedKey[]): VerifyResult {
    const lineKey = Buffer.from(line.publicKeyB64, "base64");
    for (const remoteKey of remoteKeys) {
      if (remoteKey.type === line.algo && remoteKey.equals(lineKey)) {
        return {
          result: VerifyResultCode.OK,
          publicKey: lineKey
        };
      }
    }
    return {
      result: VerifyResultCode.CHANGED,
      publicKey: lineKey
    };
  }
}
