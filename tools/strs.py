import struct, sys, re
d = open(sys.argv[1],'rb').read()
out=[]; p=0; n=len(d)
while p+4 <= n:
    L = struct.unpack('<I', d[p:p+4])[0]
    if 1 <= L <= 4000 and p+4+L <= n:
        raw = d[p+4:p+4+L]
        try: s = raw.decode('utf-8')
        except UnicodeDecodeError: p+=1; continue
        if s and not any(ord(c) < 0x20 and c not in '\n' for c in s):
            out.append((p, s)); p += 4 + ((L+3)//4)*4; continue
    p += 1
seen=set()
for off,s in out:
    if s in seen: continue
    seen.add(s)
    print(s)
