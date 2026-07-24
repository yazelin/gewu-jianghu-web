import struct, sys, json

def parse(path):
    b = open(path,'rb').read()
    ic, cc, tlc, tc = struct.unpack('<4I', b[:16]); p = 16
    idents = []
    for _ in range(ic):
        n = struct.unpack('<I', b[p:p+4])[0]; p += 4
        cs = bytes(x ^ 0xb6 for x in b[p:p+n*4]); p += n*4
        idents.append(''.join(chr(struct.unpack('<I', cs[j*4:j*4+4])[0]) for j in range(n)))
    consts = []
    for _ in range(cc):
        h = struct.unpack('<I', b[p:p+4])[0]; p += 4
        t = h & 0xffff; f64 = bool(h & (1 << 16))
        if t == 0: consts.append(None)
        elif t == 1:
            consts.append(bool(struct.unpack('<i', b[p:p+4])[0])); p += 4
        elif t == 2:
            if f64: consts.append(struct.unpack('<q', b[p:p+8])[0]); p += 8
            else:   consts.append(struct.unpack('<i', b[p:p+4])[0]); p += 4
        elif t == 3:
            if f64: consts.append(struct.unpack('<d', b[p:p+8])[0]); p += 8
            else:   consts.append(struct.unpack('<f', b[p:p+4])[0]); p += 4
        elif t == 4:
            n = struct.unpack('<I', b[p:p+4])[0]; p += 4
            consts.append(b[p:p+n].decode('utf-8','replace')); p += ((n+3)//4)*4
        else:
            raise SystemExit(f'unhandled variant type {t} at const #{len(consts)} in {path}')
    return idents, consts

if __name__ == '__main__':
    i, c = parse(sys.argv[1])
    print(json.dumps({'identifiers': i, 'constants': c}, ensure_ascii=False, indent=0))
