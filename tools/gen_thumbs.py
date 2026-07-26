#!/usr/bin/env python3
# 產生 design.html(攻略站)專用縮圖 —— assets/thumb/*.webp
#
# 為什麼要有這支:攻略站把全解析度美術當小圖用。實測 1280 寬桌機上——
#   .who 立繪    顯示 104x142,原圖最大 1024x1536(9.8 倍),19 檔共 2.27 MB
#   結局圖(格線)顯示 346x195,原圖 1672x941(4.8 倍),8 檔共 2.46 MB
# 整頁滑完要載 9.3 MB。縮到 2x 螢幕剛好夠用的尺寸,可省約 4 MB。
#
# 不動的兩組(縮了會變糊):
#   證物切格  440x372 顯示 346px → 只有 1.27x,2x 螢幕下本來就不夠
#   章節背景  1672x941 顯示 1178px → 1.42x,同上
#
# 尺寸是「2 × 實測顯示尺寸」,不是猜的。改了 design.html 的版面就要重量一次。
#
# 用法:python3 tools/gen_thumbs.py        (先跑 gen_design.py,本支讀 design.html 決定要產哪些)
import os, re, sys
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, 'assets', 'thumb')
Q = 84          # WebP 品質:縮圖看不出 84 與 92 的差別,但檔案小一半

# 顯示尺寸(1x)→ 產 2x。cover=True 表示 CSS 有 object-fit:cover + object-position:top center,
# 要照瀏覽器的裁法先裁再縮,縮圖才跟原本看到的一模一樣。
SPECS = {
    'who':    dict(w=104, h=142, cover=True),    # .who img
    'ending': dict(w=346, h=195, cover=False),   # 結局格線裡的 article img(width:100%)
}


def cover_box(nw, nh, w, h):
    """算出 object-fit:cover + object-position:top center 實際看得到的原圖區域。"""
    scale = max(w / nw, h / nh)
    vw, vh = w / scale, h / scale
    x = (nw - vw) / 2.0            # center
    y = 0.0                        # top
    return (round(x), round(y), round(x + vw), round(y + vh))


def make(src_rel, spec_name):
    spec = SPECS[spec_name]
    src = os.path.join(R, src_rel)
    if not os.path.exists(src):
        return None, f'原圖不存在:{src_rel}'
    dst_rel = 'assets/thumb/' + os.path.basename(src_rel)
    dst = os.path.join(R, dst_rel)
    im = Image.open(src).convert('RGB')
    tw, th = spec['w'] * 2, spec['h'] * 2
    if spec['cover']:
        im = im.crop(cover_box(im.width, im.height, spec['w'], spec['h']))
        im = im.resize((tw, th), Image.LANCZOS)
    else:
        im = im.resize((tw, round(im.height * tw / im.width)), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    im.save(dst, 'WEBP', quality=Q, method=6)
    return dst_rel, None


def main():
    doc = open(os.path.join(R, 'design.html'), encoding='utf-8').read()
    # design.html 是唯一事實來源:它引用了哪些 assets/thumb/ 就產哪些。
    # data-thumb-kind 由 gen_design.py 標上,說明該張是照哪組規格縮的。
    # 連 width/height 一起抓:那是 gen_design.py 寫的顯示尺寸,拿來當產出的驗收基準。
    # 素材換了長寬比時,產出尺寸會跟標籤不符 → 直接報錯,不要靜默出一張比例錯的圖。
    wanted = re.findall(
        r'src="assets/thumb/([^"]+)" data-thumb-kind="(\w+)" width="(\d+)" height="(\d+)"', doc)
    if not wanted:
        print('design.html 沒有引用 assets/thumb/ —— 先跑 python3 tools/gen_design.py', file=sys.stderr)
        return 1
    # 反查原圖:同檔名在 assets/img/ 或 assets/cells/
    before = after = 0
    errs = []
    for name, kind, ew, eh in sorted(set(wanted)):
        for base in ('assets/img', 'assets/cells'):
            cand = f'{base}/{name}'
            if os.path.exists(os.path.join(R, cand)):
                before += os.path.getsize(os.path.join(R, cand))
                rel, err = make(cand, kind)
                if err:
                    errs.append(err)
                else:
                    after += os.path.getsize(os.path.join(R, rel))
                    gw, gh = Image.open(os.path.join(R, rel)).size
                    if (gw, gh) != (int(ew), int(eh)):
                        errs.append(f'{name} 產出 {gw}x{gh} 但標籤寫 {ew}x{eh}'
                                    f'(素材長寬比變了?改 gen_design.py 的 THUMB_2X)')
                break
        else:
            errs.append(f'找不到原圖:{name}')
    for e in errs:
        print('  !', e, file=sys.stderr)
    n = len(set(wanted))
    print(f'產生 {n} 張縮圖 → assets/thumb/')
    print(f'原圖合計 {before/1048576:.2f} MB → 縮圖合計 {after/1048576:.2f} MB'
          f'(省 {(before-after)/1048576:.2f} MB,{100*(before-after)/before:.0f}%)')
    return 1 if errs else 0


if __name__ == '__main__':
    sys.exit(main())
