import struct
from gdconst import parse

LB, RB, LK, RK, COMMA, COLON, IDENT, LIT, MINUS = 201, 202, 203, 204, 207, 212, 130, 131, 176

def tokens(path):
    b = open(path, 'rb').read()
    ic, cc, tlc, tc = struct.unpack('<4I', b[:16])
    ids, cs = parse(path)
    p = 16
    for _ in range(ic):
        n = struct.unpack('<I', b[p:p+4])[0]; p += 4 + n*4
    for _ in range(cc):
        h = struct.unpack('<I', b[p:p+4])[0]; p += 4
        t, f64 = h & 0xffff, bool(h & (1 << 16))
        if t == 1: p += 4
        elif t in (2, 3): p += 8 if f64 else 4
        elif t == 4:
            n = struct.unpack('<I', b[p:p+4])[0]; p += 4 + ((n+3)//4)*4
    p += 2 * tlc * 8
    out = []
    for k in range(tc):
        a, ln = struct.unpack('<II', b[p+k*8:p+k*8+8])
        out.append((a & 0xff, a >> 8, ln))
    return out, ids, cs

def load_consts(path):
    """Return {const_name: python_value} for every `const X := <literal>` in the script."""
    toks, ids, cs = tokens(path)
    res, i, n = {}, 0, len(toks)

    def value(i):
        t, idx, _ = toks[i]
        if t == LIT:   return cs[idx], i + 1
        if t == IDENT:
            if toks[i+1][0] == 205:                      # Name(...) call, e.g. Vector2(x, y)
                a, j = [], i + 2
                while toks[j][0] != 206:
                    if toks[j][0] == COMMA: j += 1; continue
                    v, j = value(j); a.append(v)
                return (a if ids[idx] != 'Vector2' else {'x': a[0], 'y': a[1]}), j + 1
            return {'$ident': ids[idx]}, i + 1
        if t == MINUS:
            v, j = value(i + 1); return -v, j
        if t == LK:
            d, i = {}, i + 1
            while toks[i][0] != RK:
                if toks[i][0] == COMMA: i += 1; continue
                k, i = value(i)
                assert toks[i][0] == COLON, toks[i]
                v, i = value(i + 1)
                d[k if isinstance(k, str) else str(k)] = v
            return d, i + 1
        if t == LB:
            a, i = [], i + 1
            while toks[i][0] != RB:
                if toks[i][0] == COMMA: i += 1; continue
                v, i = value(i)
                a.append(v)
            return a, i + 1
        raise ValueError(f'unexpected token type {t} at {i}')

    while i < n - 3:
        if toks[i][0] == 185 and toks[i+1][0] == IDENT:      # `const NAME`
            name = ids[toks[i+1][1]]
            j = i + 2
            lim = j + 4
            while j < n and j < lim and toks[j][0] not in (LK, LB, LIT, MINUS): j += 1
            if j >= lim: i += 1; continue
            try:
                v, i = value(j); res[name] = v; continue
            except Exception:
                pass
        i += 1
    return res
