/*
 * Copyright 2024 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import { Logger } from "@extraterm/extraterm-extension-api";
import { KnownHosts, VerifyResultCode } from "./KnownHosts";
import ssh2 from "ssh2";


const log: Logger = {
  debug: function (msg: any, ...opts: any[]): void {
    console.log(msg, ...opts);
  },
  info: function (msg: any, ...opts: any[]): void {
    console.log(msg, ...opts);
  },
  warn: function (msg: any, ...opts: any[]): void {
    console.log(msg, ...opts);
  },
  severe: function (msg: any, ...opts: any[]): void {
    console.log(msg, ...opts);
  },
  startTime: function (label: string): void {
  },
  endTime: function (label: string): void {
  }
};

function parseKey(key: string): ssh2.ParsedKey {
  const result = ssh2.utils.parseKey(key);
  if (result instanceof Error) {
    throw result;
  }
  return result;
}


test("plain host", done => {
  const knownHosts = new KnownHosts(log);
  knownHosts.loadString(`192.168.1.1 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=
rubuntu,192.168.1.3 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEAmrcgpIsIb9RZZdlhB44addflgtm0//PVBUjrvcYuAk5Jd3qbmyD6gtifxpcMlNoRtiGo7Fr5q5x3Zl1/ZgfXncrBaqJhFHfnwLk6XBtWg3wUYOb0kZdfouFaGFPwAKkmY58GJqBM0iLavmtCHmczDT3ZfR72PPKgP5vomCKqpMs=
`);
  expect(knownHosts.lines.length).toBe(3);
  expect(knownHosts.lines[0].type).toBe("host");
  expect(knownHosts.lines[0].type).toBe("host");
  expect(knownHosts.lines[2].type).toBe("comment");

  const publicKeys = [
    parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=")
  ];
  expect(knownHosts.verify("192.168.1.1", 22, publicKeys).result).toBe(VerifyResultCode.OK);

  const publicKeys2 = [
    parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEAmrcgpIsIb9RZZdlhB44addflgtm0//PVBUjrvcYuAk5Jd3qbmyD6gtifxpcMlNoRtiGo7Fr5q5x3Zl1/ZgfXncrBaqJhFHfnwLk6XBtWg3wUYOb0kZdfouFaGFPwAKkmY58GJqBM0iLavmtCHmczDT3ZfR72PPKgP5vomCKqpMs=")
  ];

  expect(knownHosts.verify("192.168.1.3", 22, publicKeys2).result).toBe(VerifyResultCode.OK);
  expect(knownHosts.verify("rubuntu", 22, publicKeys2).result).toBe(VerifyResultCode.OK);
  done();
});

test("plain host with port", done => {
  const knownHosts = new KnownHosts(log);
  knownHosts.loadString(`[192.168.1.1]:2222 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=
rubuntu,192.168.1.3 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEAmrcgpIsIb9RZZdlhB44addflgtm0//PVBUjrvcYuAk5Jd3qbmyD6gtifxpcMlNoRtiGo7Fr5q5x3Zl1/ZgfXncrBaqJhFHfnwLk6XBtWg3wUYOb0kZdfouFaGFPwAKkmY58GJqBM0iLavmtCHmczDT3ZfR72PPKgP5vomCKqpMs=
`);
  expect(knownHosts.lines.length).toBe(3);
  expect(knownHosts.lines[0].type).toBe("host");
  expect(knownHosts.lines[0].type).toBe("host");
  expect(knownHosts.lines[2].type).toBe("comment");

  const publicKeys = [
    parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=")
  ];
  expect(knownHosts.verify("192.168.1.1", 2222, publicKeys).result).toBe(VerifyResultCode.OK);

  done();
});

test("plain host public key mismatch", done => {
  const knownHosts = new KnownHosts(log);
  knownHosts.loadString(`192.168.1.1 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=
rubuntu,192.168.1.3 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEAmrcgpIsIb9RZZdlhB44addflgtm0//PVBUjrvcYuAk5Jd3qbmyD6gtifxpcMlNoRtiGo7Fr5q5x3Zl1/ZgfXncrBaqJhFHfnwLk6XBtWg3wUYOb0kZdfouFaGFPwAKkmY58GJqBM0iLavmtCHmczDT3ZfR72PPKgP5vomCKqpMs=
`);

  const publicKeys = [
    parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCCrz28L4LKGrxay8mWLclpjQ4aQEJBHQ38DQzshyUfMlg8stRAsgXfJ+eO26MQj/Gcih+Ftdh7SpOLOnYITNROEBbGHdRSFR7fIDk/3/B4EAT5dzeP4D5srgUULaDwefIax2d2e1kRaTjaXIVvxO+5Hl29HgqoNwF7RsUu62JlnLtTiQSfr+ZSB5fq8Vicb3j63mXxz+6rSZYnny32MCWo4bVXd3wO5GgC8IoRmZWSupALiY8jNas2SuL4zSwLfedcN23aOJXa/anAZ6cEb3AH3/jyDTiCktBAVBgI7GdcTkv6NnKopQZo7I+sWowE41izL2Rn1bcJ655bXmiqb5D7")
  ];
  expect(knownHosts.verify("192.168.1.1", 22, publicKeys).result).toBe(VerifyResultCode.CHANGED);
  done();
});

test("hash host", done => {
  const knownHosts = new KnownHosts(log);

  const publicKeys = [
    parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq3A1A0ovCLQMIypva4r+IOoy6d/Untkpjh0Qg00KNKgj7MsB+0PJlqqKSQORxeRTMfsgJ8adSkwEaoz6uu7/UhDCRXcnHqaX2GtPtSZTp6PT+uI3+aF0OJ07PsRUn3NW6DRXJP37gtxykasQowNbeO54qULXyzaDkAOt504S8pHPORP7EW5P19BBJsk5PFDkzf+eTlZtQtiNK1lhEG/+a/M60ggDUoEHpRgSqB5r3RleNlDt2/dBcvKcF/3AQIpgkEqtTgmJWZrwKF9HFMeY0NI+bHEMUsvPFoVAIZqXJwR/ipv9enib0/azQzUoSJJv59ETbToima6p5kNod+SjSw==")
  ];

  // 192.168.1.2
  knownHosts.loadString(`|1|Lw/h2cw00uRxdmZeQ93a7++tPHM=|w+FeYx7J4ljE4a/k4YgY+8eXlBU= ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq3A1A0ovCLQMIypva4r+IOoy6d/Untkpjh0Qg00KNKgj7MsB+0PJlqqKSQORxeRTMfsgJ8adSkwEaoz6uu7/UhDCRXcnHqaX2GtPtSZTp6PT+uI3+aF0OJ07PsRUn3NW6DRXJP37gtxykasQowNbeO54qULXyzaDkAOt504S8pHPORP7EW5P19BBJsk5PFDkzf+eTlZtQtiNK1lhEG/+a/M60ggDUoEHpRgSqB5r3RleNlDt2/dBcvKcF/3AQIpgkEqtTgmJWZrwKF9HFMeY0NI+bHEMUsvPFoVAIZqXJwR/ipv9enib0/azQzUoSJJv59ETbToima6p5kNod+SjSw==`);
  expect(knownHosts.verify("192.168.1.2", 22, publicKeys).result).toBe(VerifyResultCode.OK);
  expect(knownHosts.verify("192.168.1.9", 22, publicKeys).result).toBe(VerifyResultCode.UNKNOWN);
  done();
});

test("hash host public key mismatch", done => {
  const knownHosts = new KnownHosts(log);

  const publicKeys = [
    parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCCrz28L4LKGrxay8mWLclpjQ4aQEJBHQ38DQzshyUfMlg8stRAsgXfJ+eO26MQj/Gcih+Ftdh7SpOLOnYITNROEBbGHdRSFR7fIDk/3/B4EAT5dzeP4D5srgUULaDwefIax2d2e1kRaTjaXIVvxO+5Hl29HgqoNwF7RsUu62JlnLtTiQSfr+ZSB5fq8Vicb3j63mXxz+6rSZYnny32MCWo4bVXd3wO5GgC8IoRmZWSupALiY8jNas2SuL4zSwLfedcN23aOJXa/anAZ6cEb3AH3/jyDTiCktBAVBgI7GdcTkv6NnKopQZo7I+sWowE41izL2Rn1bcJ655bXmiqb5D7")
  ];

  // 192.168.1.2
  knownHosts.loadString(`|1|Lw/h2cw00uRxdmZeQ93a7++tPHM=|w+FeYx7J4ljE4a/k4YgY+8eXlBU= ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq3A1A0ovCLQMIypva4r+IOoy6d/Untkpjh0Qg00KNKgj7MsB+0PJlqqKSQORxeRTMfsgJ8adSkwEaoz6uu7/UhDCRXcnHqaX2GtPtSZTp6PT+uI3+aF0OJ07PsRUn3NW6DRXJP37gtxykasQowNbeO54qULXyzaDkAOt504S8pHPORP7EW5P19BBJsk5PFDkzf+eTlZtQtiNK1lhEG/+a/M60ggDUoEHpRgSqB5r3RleNlDt2/dBcvKcF/3AQIpgkEqtTgmJWZrwKF9HFMeY0NI+bHEMUsvPFoVAIZqXJwR/ipv9enib0/azQzUoSJJv59ETbToima6p5kNod+SjSw==`);
  expect(knownHosts.verify("192.168.1.2", 22, publicKeys).result).toBe(VerifyResultCode.CHANGED);
  done();
});

test("revoked", done => {
  const knownHosts = new KnownHosts(log);
  knownHosts.loadString(`@revoked 192.168.1.1 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=
`);
  expect(knownHosts.lines.length).toBe(2);
  expect(knownHosts.lines[0].type).toBe("revoked");

  const publicKeys = [
    parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=")
  ];
  expect(knownHosts.verify("192.168.1.1", 22, publicKeys).result).toBe(VerifyResultCode.REVOKED);

  done();
});

test("unknown host with alias", done => {
  const knownHosts = new KnownHosts(log);
  knownHosts.loadString(`192.168.1.1 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=
rubuntu,192.168.1.3 ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEAmrcgpIsIb9RZZdlhB44addflgtm0//PVBUjrvcYuAk5Jd3qbmyD6gtifxpcMlNoRtiGo7Fr5q5x3Zl1/ZgfXncrBaqJhFHfnwLk6XBtWg3wUYOb0kZdfouFaGFPwAKkmY58GJqBM0iLavmtCHmczDT3ZfR72PPKgP5vomCKqpMs=
`);
  const publicKeys = [
    parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=")
  ];
  const result = knownHosts.verify("192.168.1.2", 22, publicKeys);
  expect(result.result).toBe(VerifyResultCode.UNKNOWN);
  expect(result.aliases.length).toBe(1);
  expect(result.aliases[0].line).toBe(0);
  expect(result.aliases[0].host).toBe("192.168.1.1");

  done();
});

test("unknown host with hashed alias", done => {
  const knownHosts = new KnownHosts(log);

  const publicKeys = [
    parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq3A1A0ovCLQMIypva4r+IOoy6d/Untkpjh0Qg00KNKgj7MsB+0PJlqqKSQORxeRTMfsgJ8adSkwEaoz6uu7/UhDCRXcnHqaX2GtPtSZTp6PT+uI3+aF0OJ07PsRUn3NW6DRXJP37gtxykasQowNbeO54qULXyzaDkAOt504S8pHPORP7EW5P19BBJsk5PFDkzf+eTlZtQtiNK1lhEG/+a/M60ggDUoEHpRgSqB5r3RleNlDt2/dBcvKcF/3AQIpgkEqtTgmJWZrwKF9HFMeY0NI+bHEMUsvPFoVAIZqXJwR/ipv9enib0/azQzUoSJJv59ETbToima6p5kNod+SjSw==")
  ];

  // 192.168.1.2
  knownHosts.loadString(`|1|Lw/h2cw00uRxdmZeQ93a7++tPHM=|w+FeYx7J4ljE4a/k4YgY+8eXlBU= ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq3A1A0ovCLQMIypva4r+IOoy6d/Untkpjh0Qg00KNKgj7MsB+0PJlqqKSQORxeRTMfsgJ8adSkwEaoz6uu7/UhDCRXcnHqaX2GtPtSZTp6PT+uI3+aF0OJ07PsRUn3NW6DRXJP37gtxykasQowNbeO54qULXyzaDkAOt504S8pHPORP7EW5P19BBJsk5PFDkzf+eTlZtQtiNK1lhEG/+a/M60ggDUoEHpRgSqB5r3RleNlDt2/dBcvKcF/3AQIpgkEqtTgmJWZrwKF9HFMeY0NI+bHEMUsvPFoVAIZqXJwR/ipv9enib0/azQzUoSJJv59ETbToima6p5kNod+SjSw==`);
  const result = knownHosts.verify("192.168.22.22", 22, publicKeys);
  expect(result.result).toBe(VerifyResultCode.UNKNOWN);
  expect(result.aliases.length).toBe(1);
  expect(result.aliases[0].host).toBe("[hashed host]");
  expect(result.aliases[0].line).toBe(0);

  done();
});

test("append line", done => {
  const knownHosts = new KnownHosts(log);

  const key = parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=");
  knownHosts.appendHost("192.168.1.1", 22, key);

  const result = knownHosts.verify("192.168.1.1", 22, [key]);
  expect(result.result).toBe(VerifyResultCode.OK);

  done();
});

test("append line round-trip", done => {
  const knownHosts = new KnownHosts(log);
  const key = parseKey("ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAIEA5VqOFLlef825wmfC4/yA8KLzg+K8Ay9gXiNw/ygNw+kuRZAD1nk3QXdVObH/tPy78cLjtzRzQxAkXozSsfyz0yguveHJXcG92Y1Dps402AVZsZsQwruzoTjEwcXrzOW+dIQiNw34Sa/kmG0/F6eILGtUtpR3swXGrejb0Lc0iEE=");
  knownHosts.appendHost("192.168.1.1", 22, key);

  const knownHost2 = new KnownHosts(log);
  knownHost2.loadString(knownHosts.dumpString());
  const result = knownHosts.verify("192.168.1.1", 22, [key]);
  expect(result.result).toBe(VerifyResultCode.OK);

  done();
});
