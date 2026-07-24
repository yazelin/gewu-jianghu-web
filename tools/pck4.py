import struct, sys, os, re, collections

path = sys.argv[1]
d = open(path, 'rb').read()
base = d.rfind(b'GDPC', 0, len(d)-4)
# embedded: trailer = u64 size + b'GDPC'
pck_size = struct.unpack('<q', d[-12:-4])[0]
base = len(d) - 12 - pck_size
assert d[base:base+4] == b'GDPC'
fmt, vmaj, vmin, vpat = struct.unpack('<4I', d[base+4:base+20])
flags, file_base = struct.unpack('<Iq', d[base+20:base+32])
print(f'pck fmt v{fmt} godot {vmaj}.{vmin}.{vpat} flags={flags} file_base={file_base} pck_size={pck_size}')

dir_end = len(d) - 12          # directory runs up to the trailer
tail_start = len(d) - 400000

def try_parse(p):
    ents = []
    while p < dir_end - 8:
        n = struct.unpack('<I', d[p:p+4])[0]
        if not (4 <= n <= 400) or n % 4: return None
        raw = d[p+4:p+4+n]
        s = raw.rstrip(b'\0')
        try: sp = s.decode('utf-8')
        except UnicodeDecodeError: return None
        if not sp or any(c < ' ' for c in sp): return None
        q = p + 4 + n
        if q + 36 > dir_end: return None
        off, size = struct.unpack('<qq', d[q:q+16])
        efl = struct.unpack('<I', d[q+32:q+36])[0]
        if off < 0 or size < 0 or size > pck_size: return None
        ents.append((sp, off, size, efl))
        p = q + 36
        if dir_end - p < 12:      # trailing padding before trailer
            return ents
    return None

best = None
for p in range(tail_start, dir_end):
    if d[p+1:p+4] != b'\0\0\0': continue
    r = try_parse(p)
    if r and len(r) > 50 and (best is None or len(r) > len(best)):
        best = r; print(f'directory start = {p} (pck-rel {p-base}), entries = {len(r)}')
        break
assert best, 'directory not found'
ents = best

# resolve offset base empirically using the first entry
cands = {'abs': 0, 'pck': base, 'filebase': base + file_base}
sp, off, size, _ = ents[0]
for name, add in cands.items():
    o = add + off
    print(f'  {name}: {o} -> {d[o:o+24]!r}')

out = sys.argv[2]
add = base + file_base
fl = collections.Counter(e[3] for e in ents)
print('\nentry flags:', dict(fl))
byext = collections.Counter(); tot = collections.Counter()
for sp, off, size, efl in ents:
    e = os.path.splitext(sp)[1].lower(); byext[e]+=1; tot[e]+=size
    dst = os.path.join(out, sp)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst,'wb').write(d[add+off:add+off+size])
print('\n%-22s %5s %12s' % ('ext','n','bytes'))
for e,c in byext.most_common(): print('%-22s %5d %12d' % (e or '(none)', c, tot[e]))
print('\n--- all paths ---')
for sp,_,size,_ in sorted(ents): print('%10d  %s' % (size, sp))
