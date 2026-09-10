#!/usr/bin/env python3
"""Generate branded placeholder icons for Amplience Frontend Starter content types.

Style system (matched to the branded examples, tuned per Matt's review):
  - steel blue line work #1f5e8c, round caps/joins, ~3.5px main stroke at 256
  - light periwinkle 45-degree hatching #c9d5f6, tight spacing
  - white glyphs with soft blue offset shadow #e3eafc
  - rounded landscape card centred on a square 256x256 transparent canvas
Two treatments:
  A: hatched card + white outlined glyph (content 'leaf' types)
  B: white card with steel-blue border, structural diagram inside (layout types)

Excluded (originals will be reused): media/image, slot; future: tabs, video, code block.
"""
import os
import cairosvg

DARK = "#1f5e8c"
HATCH = "#c9d5f6"
SHADOW = "#e3eafc"
OUT_SVG = "svg"
OUT_PNG = "png"

# stroke weights
SW = 2.8        # main glyph outline
SW_MED = 2.5    # connectors, secondary
SW_THIN = 2.3   # pills, small details, faint lines
SW_BLOCK = 2.2  # hatched block borders
SW_TITLE = 4.0  # bold 'title' text lines

DEFS = f"""
<defs>
  <pattern id="hatchL" patternUnits="userSpaceOnUse" width="5.5" height="5.5" patternTransform="rotate(45)">
    <rect width="5.5" height="5.5" fill="#ffffff"/>
    <line x1="0.9" y1="0" x2="0.9" y2="5.5" stroke="{HATCH}" stroke-width="1.8"/>
  </pattern>
  <pattern id="hatchD" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
    <rect width="6" height="6" fill="#ffffff"/>
    <line x1="0.9" y1="0" x2="0.9" y2="6" stroke="{DARK}" stroke-width="1.7"/>
  </pattern>
</defs>
"""

CARD = dict(x=16, y=40, w=220, h=176, rx=18)


def svg_doc(body):
    # landscape crop around the card: 512x409 output aspect (matches originals)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 28.75 256 204.5" '
            f'fill="none" stroke-linecap="round" stroke-linejoin="round">'
            f'{DEFS}{body}</svg>')


def card_a(inner):
    c = CARD
    return (
        f'<rect x="{c["x"]+6}" y="{c["y"]+6}" width="{c["w"]}" height="{c["h"]}" rx="{c["rx"]}" fill="{SHADOW}"/>'
        f'<rect x="{c["x"]}" y="{c["y"]}" width="{c["w"]}" height="{c["h"]}" rx="{c["rx"]}" fill="url(#hatchL)"/>'
        + inner)


def card_b(inner):
    c = CARD
    return (
        f'<rect x="{c["x"]+6}" y="{c["y"]+6}" width="{c["w"]}" height="{c["h"]}" rx="{c["rx"]}" fill="{SHADOW}"/>'
        f'<rect x="{c["x"]}" y="{c["y"]}" width="{c["w"]}" height="{c["h"]}" rx="{c["rx"]}" fill="#ffffff" stroke="{DARK}" stroke-width="2.4"/>'
        + inner)


def shadowed(shape_fmt, dx=4, dy=4):
    """shape_fmt is a format string with {fill} and {stroke} and {tx},{ty}."""
    return (shape_fmt.format(fill=SHADOW, stroke="none", tx=dx, ty=dy)
            + shape_fmt.format(fill="#ffffff", stroke=DARK, tx=0, ty=0))


ICONS = {}

# ---------- Treatment A ----------

# media: mountain + sun
mountain = ('<g transform="translate({tx},{ty})">'
            '<path d="M60 174 h132 a7 7 0 0 0 5.6-11.2 L154 116 q-6-8-12 0 l-17 22 -26 -35 q-6-8 -12 0 l-32.6 60 A7 7 0 0 0 60 174 Z" '
            f'fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
            f'<circle cx="178" cy="94" r="12" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
            '</g>')
ICONS["content_media"] = card_a(shadowed(mountain))

# slot: isometric platform with centred cross
slot = ('<g transform="translate({tx},{ty})">'
        '<path d="M126 82 L208 128 L208 140 L126 186 L44 140 L44 128 Z" fill="{fill}" stroke="{stroke}" stroke-width="' + str(SW) + '"/>'
        '<path d="M44 128 L126 174 L208 128" fill="none" stroke="{stroke}" stroke-width="' + str(SW) + '"/>'
        '<path d="M99 113 L153 143 M153 113 L99 143" fill="none" stroke="{stroke}" stroke-width="' + str(SW) + '"/>'
        '</g>')
ICONS["slots_slot"] = card_a(shadowed(slot))

# hierarchy-menu: parent node with three indented child menu-items on a trunk
hier_menu = ('<g transform="translate({tx},{ty})">'
             # trunk + elbows
             f'<path d="M76 92 v87 M76 111 h16 M76 145 h16 M76 179 h16" fill="none" stroke="{{stroke}}" stroke-width="{SW_MED}"/>'
             # parent node
             f'<rect x="64" y="58" width="92" height="32" rx="9" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
             f'<circle cx="80" cy="74" r="4.5" fill="{{stroke}}"/>'
             f'<path d="M92 74 h44" stroke="{{stroke}}" stroke-width="{SW_MED}"/>'
             # child menu-items (mini versions of the hierarchy-menu-item node)
             f'<rect x="92" y="98" width="96" height="26" rx="8" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
             f'<circle cx="106" cy="111" r="4" fill="{{stroke}}"/>'
             f'<path d="M117 111 h49" stroke="{{stroke}}" stroke-width="{SW_MED}"/>'
             f'<rect x="92" y="132" width="96" height="26" rx="8" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
             f'<circle cx="106" cy="145" r="4" fill="{{stroke}}"/>'
             f'<path d="M117 145 h49" stroke="{{stroke}}" stroke-width="{SW_MED}"/>'
             f'<rect x="92" y="166" width="96" height="26" rx="8" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
             f'<circle cx="106" cy="179" r="4" fill="{{stroke}}"/>'
             f'<path d="M117 179 h49" stroke="{{stroke}}" stroke-width="{SW_MED}"/>'
             '</g>')
ICONS["content_hierarchy-menu"] = card_a(shadowed(hier_menu))

# hierarchy-menu-item: one node hanging off a tree connector
hier_item = ('<g transform="translate({tx},{ty})">'
             f'<path d="M72 74 v96 M72 122 h24" fill="none" stroke="{{stroke}}" stroke-width="{SW_MED}"/>'
             f'<rect x="96" y="100" width="108" height="44" rx="11" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
             '<circle cx="118" cy="122" r="5.5" fill="{stroke}"/>'
             f'<path d="M134 122 h48" stroke="{{stroke}}" stroke-width="{SW}"/>'
             '</g>')
ICONS["content_hierarchy-menu-item"] = card_a(shadowed(hier_item))

# rich text block (schema name markdown-block): "Tt" — bold T, italic t,
# representing formatted text (representative, like the mountain for media)
richtext = ('<g transform="translate({tx},{ty})">'
            f'<rect x="58" y="88" width="136" height="80" rx="13" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
            # bold capital T
            '<path d="M76 108 h42 M97 108 v42" fill="none" stroke="{stroke}" stroke-width="7.5"/>'
            # italic lowercase t
            '<path d="M158 104 l-8.5 40 q-1.2 7 5.8 5.5" fill="none" stroke="{stroke}" stroke-width="3.5"/>'
            '<path d="M142 119 h24" fill="none" stroke="{stroke}" stroke-width="3.5"/>'
            '</g>')
ICONS["content_markdown-block"] = card_a(shadowed(richtext))

# icon-button: app-style rounded button with star
icon_button = ('<g transform="translate({tx},{ty})">'
               f'<rect x="84" y="84" width="88" height="88" rx="22" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
               '<path d="M128 104 l7.6 15.4 17 2.5 -12.3 12 2.9 16.9 -15.2 -8 -15.2 8 2.9 -16.9 -12.3 -12 17 -2.5 Z" '
               f'fill="none" stroke="{{stroke}}" stroke-width="{SW_MED}"/>'
               '</g>')
ICONS["content_icon-button"] = card_a(shadowed(icon_button))

# menu-toggle-button: app-style rounded button with hamburger lines
menu_toggle_button = ('<g transform="translate({tx},{ty})">'
                      f'<rect x="84" y="84" width="88" height="88" rx="22" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
                      '<path d="M106 110 h44 M106 128 h44 M106 146 h44" '
                      f'fill="none" stroke="{{stroke}}" stroke-width="{SW_MED}"/>'
                      '</g>')
ICONS["content_menu-toggle-button"] = card_a(shadowed(menu_toggle_button))

# locale-selector: a globe — meridian ellipse, polar axis, equator + parallels
locale_selector = ('<g transform="translate({tx},{ty})">'
                   f'<circle cx="128" cy="128" r="46" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
                   f'<path d="M83 128 h90" fill="none" stroke="{{stroke}}" stroke-width="{SW_THIN}"/>'
                   f'<path d="M94 108 h68 M94 148 h68" fill="none" stroke="{{stroke}}" stroke-width="{SW_THIN}"/>'
                   f'<ellipse cx="128" cy="128" rx="19" ry="46" fill="none" stroke="{{stroke}}" stroke-width="{SW_THIN}"/>'
                   f'<path d="M128 82 v92" fill="none" stroke="{{stroke}}" stroke-width="{SW_THIN}"/>'
                   '</g>')
ICONS["content_locale-selector"] = card_a(shadowed(locale_selector))

# logo: circular badge with abstract diamond mark
logo = ('<g transform="translate({tx},{ty})">'
        f'<circle cx="126" cy="128" r="48" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
        f'<path d="M126 102 L150 128 L126 154 L102 128 Z" fill="none" stroke="{{stroke}}" stroke-width="{SW}"/>'
        '<circle cx="126" cy="128" r="5.5" fill="{stroke}"/>'
        '</g>')
ICONS["content_logo"] = card_a(shadowed(logo))

# hero: banner with headline and CTA pill
hero = ('<g transform="translate({tx},{ty})">'
        f'<rect x="44" y="82" width="164" height="92" rx="13" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
        f'<path d="M62 108 h88" stroke="{{stroke}}" stroke-width="{SW_TITLE}"/>'
        f'<path d="M62 126 h58" stroke="{{stroke}}" stroke-width="{SW_THIN}"/>'
        f'<rect x="62" y="140" width="46" height="19" rx="9.5" fill="none" stroke="{{stroke}}" stroke-width="{SW_THIN}"/>'
        '</g>')
ICONS["content_hero"] = card_a(shadowed(hero))

# media-card: vertical card, image area on top, copy + CTA below
media_card = ('<g transform="translate({tx},{ty})">'
              f'<rect x="74" y="58" width="104" height="140" rx="13" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
              f'<rect x="86" y="70" width="80" height="46" rx="7" fill="url(#hatchL)" stroke="{{stroke}}" stroke-width="{SW_BLOCK}"/>'
              f'<path d="M88 134 h74" stroke="{{stroke}}" stroke-width="3.2"/>'
              f'<path d="M88 150 h58" stroke="{{stroke}}" stroke-width="{SW_THIN}"/>'
              f'<rect x="88" y="162" width="40" height="17" rx="8.5" fill="none" stroke="{{stroke}}" stroke-width="{SW_THIN}"/>'
              '</g>')
ICONS["content_media-card"] = card_a(shadowed(media_card))

# custom-css (site config): a CSS rule block — a stylesheet card with curly
# braces around a property colon, reading as `{ : }`
custom_css = ('<g transform="translate({tx},{ty})">'
              f'<rect x="64" y="82" width="128" height="92" rx="13" fill="{{fill}}" stroke="{{stroke}}" stroke-width="{SW}"/>'
              '<path d="M112 106 q-10 0 -10 11 v5 q0 6 -6 6 q6 0 6 6 v5 q0 11 10 11" '
              'fill="none" stroke="{stroke}" stroke-width="3.6"/>'
              '<path d="M144 106 q10 0 10 11 v5 q0 6 6 6 q-6 0 -6 6 v5 q0 11 -10 11" '
              'fill="none" stroke="{stroke}" stroke-width="3.6"/>'
              '<circle cx="128" cy="121" r="2.8" fill="{stroke}"/>'
              '<circle cx="128" cy="135" r="2.8" fill="{stroke}"/>'
              '</g>')
ICONS["sitestructure_custom-css"] = card_a(shadowed(custom_css))

# ---------- Treatment B ----------

# page: browser chrome + hatched hero + text lines
page = (f'<circle cx="38" cy="59" r="4" fill="{DARK}"/>'
        f'<circle cx="54" cy="59" r="4" fill="{DARK}"/>'
        f'<circle cx="70" cy="59" r="4" fill="{DARK}"/>'
        f'<path d="M16 78 h220" stroke="{DARK}" stroke-width="{SW_THIN}"/>'
        f'<rect x="36" y="94" width="180" height="58" rx="9" fill="url(#hatchL)" stroke="{DARK}" stroke-width="{SW_BLOCK}"/>'
        f'<path d="M36 172 h146" stroke="{DARK}" stroke-width="{SW_MED}"/>'
        f'<path d="M36 190 h104" stroke="{HATCH}" stroke-width="{SW_MED}"/>')
ICONS["content_page"] = card_b(page)


# header: dark-hatched top band, faint body
header = (f'<path d="M20 84 v-26 a18 18 0 0 1 18-18 h176 a18 18 0 0 1 18 18 v26 Z" fill="url(#hatchD)"/>'
          f'<path d="M16 88 h220" stroke="{DARK}" stroke-width="{SW_THIN}"/>'
          f'<path d="M40 120 h160 M40 144 h176 M40 168 h132" stroke="{HATCH}" stroke-width="3.2"/>')
ICONS["content_header"] = card_b(header)

# footer: dark-hatched bottom band, faint body
footer = (f'<path d="M20 172 v26 a18 18 0 0 0 18 18 h176 a18 18 0 0 0 18-18 v-26 Z" fill="url(#hatchD)"/>'
          f'<path d="M16 168 h220" stroke="{DARK}" stroke-width="{SW_THIN}"/>'
          f'<path d="M40 72 h160 M40 96 h176 M40 120 h132" stroke="{HATCH}" stroke-width="3.2"/>')
ICONS["content_footer"] = card_b(footer)

# header-row: band with logo dot, nav lines, CTA pill
header_row = (f'<path d="M16 102 h220 M16 154 h220" stroke="{DARK}" stroke-width="{SW_THIN}"/>'
              f'<circle cx="48" cy="128" r="9" fill="{DARK}"/>'
              f'<path d="M70 128 h34 M116 128 h34" stroke="{DARK}" stroke-width="{SW}"/>'
              f'<rect x="164" y="117" width="44" height="22" rx="11" fill="none" stroke="{DARK}" stroke-width="{SW_THIN}"/>')
ICONS["content_header-row"] = card_b(header_row)

# footer-row: band with social dots and small text lines
footer_row = (f'<path d="M16 102 h220 M16 154 h220" stroke="{DARK}" stroke-width="{SW_THIN}"/>'
              f'<circle cx="58" cy="128" r="8" fill="none" stroke="{DARK}" stroke-width="{SW_THIN}"/>'
              f'<circle cx="86" cy="128" r="8" fill="none" stroke="{DARK}" stroke-width="{SW_THIN}"/>'
              f'<circle cx="114" cy="128" r="8" fill="none" stroke="{DARK}" stroke-width="{SW_THIN}"/>'
              f'<path d="M140 121 h66 M140 136 h48" stroke="{DARK}" stroke-width="{SW_MED}"/>')
ICONS["content_footer-row"] = card_b(footer_row)

# header-group: bracket enclosing grouped blocks, loose blocks either side
header_group = (f'<rect x="30" y="114" width="28" height="28" rx="6" fill="none" stroke="{HATCH}" stroke-width="{SW_THIN}"/>'
                f'<rect x="194" y="114" width="28" height="28" rx="6" fill="none" stroke="{HATCH}" stroke-width="{SW_THIN}"/>'
                f'<rect x="79" y="114" width="28" height="28" rx="6" fill="url(#hatchL)" stroke="{DARK}" stroke-width="{SW_BLOCK}"/>'
                f'<rect x="112" y="114" width="28" height="28" rx="6" fill="url(#hatchL)" stroke="{DARK}" stroke-width="{SW_BLOCK}"/>'
                f'<rect x="145" y="114" width="28" height="28" rx="6" fill="url(#hatchL)" stroke="{DARK}" stroke-width="{SW_BLOCK}"/>')
ICONS["content_header-group"] = card_b(header_group)

# columns: three equal vertical columns, all light-hatched
columns = (f'<rect x="40" y="74" width="48" height="108" rx="9" fill="url(#hatchL)" stroke="{DARK}" stroke-width="{SW_BLOCK}"/>'
           f'<rect x="102" y="74" width="48" height="108" rx="9" fill="url(#hatchL)" stroke="{DARK}" stroke-width="{SW_BLOCK}"/>'
           f'<rect x="164" y="74" width="48" height="108" rx="9" fill="url(#hatchL)" stroke="{DARK}" stroke-width="{SW_BLOCK}"/>')
ICONS["content_columns"] = card_b(columns)

# grid: 2x3 tiles, all light-hatched
def tile(x, y, dark=False):
    fill = "url(#hatchD)" if dark else "url(#hatchL)"
    return f'<rect x="{x}" y="{y}" width="52" height="52" rx="8" fill="{fill}" stroke="{DARK}" stroke-width="{SW_BLOCK}"/>'

grid = (tile(40, 70) + tile(100, 70) + tile(160, 70)
        + tile(40, 134) + tile(100, 134) + tile(160, 134))
ICONS["content_grid"] = card_b(grid)

# carousel: a row of slides running off both card edges, plus pagination dots.
# Distinguished from columns (three equal columns, fully contained) and grid
# (a contained 2x3) by the clipping: the slides are wider than the card, which
# is the whole point of a carousel and reads at small sizes without arrows.
# Two full slides, symmetric 24px slivers either side, 12px gaps throughout.
_c = CARD
CARD_CLIP = (f'<defs><clipPath id="cardClip">'
             f'<rect x="{_c["x"]}" y="{_c["y"]}" width="{_c["w"]}" height="{_c["h"]}" rx="{_c["rx"]}"/>'
             f'</clipPath></defs>')


def cslide(x):
    return (f'<rect x="{x}" y="70" width="68" height="100" rx="9" '
            f'fill="url(#hatchL)" stroke="{DARK}" stroke-width="{SW_BLOCK}"/>')


def cdot(cx, active=False):
    if active:
        return f'<circle cx="{cx}" cy="192" r="5" fill="{DARK}"/>'
    return f'<circle cx="{cx}" cy="192" r="4" fill="{HATCH}"/>'


carousel = (CARD_CLIP
            + f'<g clip-path="url(#cardClip)">'
            + cslide(-28) + cslide(52) + cslide(132) + cslide(212)
            + '</g>'
            + cdot(107, active=True) + cdot(121) + cdot(135) + cdot(149))
ICONS["content_carousel"] = card_b(carousel)

# ---------- Aliases ----------
# Types that deliberately share an icon. Files are still written out under
# each name so every content type has an explicit png/svg pair.
ALIASES = {
    "content_blog-article": "content_page",
    "content_menu": "content_hierarchy-menu",
    "content_menu-item": "content_hierarchy-menu-item",
}
for _alias, _source in ALIASES.items():
    ICONS[_alias] = ICONS[_source]


def main():
    os.makedirs(OUT_SVG, exist_ok=True)
    os.makedirs(OUT_PNG, exist_ok=True)
    for name, body in sorted(ICONS.items()):
        doc = svg_doc(body)
        svg_path = os.path.join(OUT_SVG, f"{name}.svg")
        with open(svg_path, "w") as f:
            f.write(doc)
        cairosvg.svg2png(bytestring=doc.encode(), write_to=os.path.join(OUT_PNG, f"{name}.png"),
                         output_width=512, output_height=409)
    print(f"generated {len(ICONS)} icons")

    # contact sheet
    from PIL import Image, ImageDraw
    names = sorted(ICONS)
    cols, cw, ch = 5, 512, 409
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cw, rows * (ch + 28)), "#f7f9ff")
    d = ImageDraw.Draw(sheet)
    for i, n in enumerate(names):
        img = Image.open(os.path.join(OUT_PNG, f"{n}.png"))
        x, y = (i % cols) * cw, (i // cols) * (ch + 28)
        d.text((x + 16, y + 8), n.replace("content_", "").replace("slots_", ""), fill="#1f5e8c")
        sheet.paste(img, (x, y + 28), img)
    sheet = sheet.resize((sheet.width // 2, sheet.height // 2))
    sheet.save("contact_sheet.png")
    print("contact sheet written")


if __name__ == "__main__":
    main()
