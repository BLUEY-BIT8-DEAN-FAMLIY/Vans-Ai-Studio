/* Real .docx and .pptx generation in the browser - no libraries, no server.
   Both formats are OOXML: a ZIP of XML parts. We write the minimum set of
   parts Word and PowerPoint need, with RTL support so Hebrew lays out right. */
const Office = (() => {
  const esc = Zip.esc;

  const isRtlText = s => /[֐-׿؀-ۿ]/.test(String(s || ''));

  /* ============================ DOCX ============================ */
  /* blocks: [{ type: 'title'|'h1'|'h2'|'p'|'bullet'|'number', text }] */
  function buildDocx(blocks, opts) {
    const o = opts || {};
    const rtl = o.rtl !== undefined ? o.rtl : true;

    const contentTypes =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;

    const rels =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const docRels =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`;

    const styleDef = (id, name, sz, bold, color, spaceBefore) =>
`<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/>
<w:pPr><w:spacing w:before="${spaceBefore}" w:after="120"/>${rtl ? '<w:bidi/>' : ''}</w:pPr>
<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>${bold ? '<w:b/><w:bCs/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}</w:rPr></w:style>`;

    const styles =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>
${styleDef('Title', 'Title', 60, true, '1F3864', 0)}
${styleDef('Heading1', 'heading 1', 36, true, '2E74B5', 320)}
${styleDef('Heading2', 'heading 2', 28, true, '2E74B5', 240)}
${styleDef('Normal', 'Normal', 24, false, '', 0)}
</w:styles>`;

    const numbering =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;

    function para(b) {
      const text = String(b.text == null ? '' : b.text);
      const dirRtl = rtl || isRtlText(text);
      const bidi = dirRtl ? '<w:bidi/><w:jc w:val="right"/>' : '';
      const runRtl = dirRtl ? '<w:rtl/>' : '';
      let style = '', numPr = '';
      if (b.type === 'title') style = '<w:pStyle w:val="Title"/>';
      else if (b.type === 'h1') style = '<w:pStyle w:val="Heading1"/>';
      else if (b.type === 'h2') style = '<w:pStyle w:val="Heading2"/>';
      else if (b.type === 'bullet') numPr = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>';
      else if (b.type === 'number') numPr = '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>';
      const runs = text.split('\n').map((line, i) =>
        (i ? '<w:br/>' : '') + `<w:r><w:rPr>${runRtl}</w:rPr><w:t xml:space="preserve">${esc(line)}</w:t></w:r>`
      ).join('');
      return `<w:p><w:pPr>${style}${numPr}${bidi}</w:pPr>${runs}</w:p>`;
    }

    const body = blocks.map(para).join('');
    const document =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body}
<w:sectPr>${rtl ? '<w:bidi/>' : ''}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>
</w:body></w:document>`;

    return Zip.build([
      { name: '[Content_Types].xml', data: contentTypes },
      { name: '_rels/.rels', data: rels },
      { name: 'word/document.xml', data: document },
      { name: 'word/_rels/document.xml.rels', data: docRels },
      { name: 'word/styles.xml', data: styles },
      { name: 'word/numbering.xml', data: numbering }
    ]);
  }

  /* ============================ PPTX ============================ */
  /* slides: [{ title, bullets: [], imageBytes?: Uint8Array }] */
  const W = 12192000, H = 6858000;   // 16:9 in EMU

  const THEME =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Vans">
<a:themeElements>
<a:clrScheme name="Vans"><a:dk1><a:srgbClr val="10112A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="1B1D38"/></a:dk2><a:lt2><a:srgbClr val="EEF0FF"/></a:lt2>
<a:accent1><a:srgbClr val="7C3AED"/></a:accent1><a:accent2><a:srgbClr val="22D3EE"/></a:accent2>
<a:accent3><a:srgbClr val="8B5CF6"/></a:accent3><a:accent4><a:srgbClr val="0EA5E9"/></a:accent4>
<a:accent5><a:srgbClr val="14B8A6"/></a:accent5><a:accent6><a:srgbClr val="F59E0B"/></a:accent6>
<a:hlink><a:srgbClr val="22D3EE"/></a:hlink><a:folHlink><a:srgbClr val="8B5CF6"/></a:folHlink></a:clrScheme>
<a:fontScheme name="Vans"><a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:majorFont>
<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Vans">
<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
</a:fmtScheme></a:themeElements></a:theme>`;

  const SLIDE_MASTER =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="10112A"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld><p:clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;

  const SLIDE_LAYOUT =
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

  function textShape({ id, name, x, y, cx, cy, paras }) {
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;
  }

  function slideXml(slide, hasImage) {
    const rtl = isRtlText(slide.title) || (slide.bullets || []).some(isRtlText);
    const align = rtl ? 'r' : 'l';
    const rtlAttr = rtl ? ' rtl="1"' : '';
    const imgW = 4600000;
    const bodyW = hasImage ? (W - imgW - 1600000) : (W - 1600000);
    const bodyX = (rtl && hasImage) ? (imgW + 1100000) : 800000;
    const imgX = (rtl && hasImage) ? 500000 : (W - imgW - 500000);

    const titlePara =
`<a:p><a:pPr algn="${align}"${rtlAttr}/><a:r><a:rPr lang="en-US" sz="3600" b="1" dirty="0"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Calibri"/><a:cs typeface="Arial"/></a:rPr><a:t>${esc(slide.title || '')}</a:t></a:r></a:p>`;

    const bulletParas = (slide.bullets || []).filter(b => String(b).trim()).map(b =>
`<a:p><a:pPr algn="${align}"${rtlAttr} marL="285750" indent="-285750"><a:lnSpc><a:spcPct val="110000"/></a:lnSpc><a:spcBef><a:spcPts val="900"/></a:spcBef><a:buChar char="&#8226;"/></a:pPr><a:r><a:rPr lang="en-US" sz="2000" dirty="0"><a:solidFill><a:srgbClr val="D7DAF0"/></a:solidFill><a:latin typeface="Calibri"/><a:cs typeface="Arial"/></a:rPr><a:t>${esc(b)}</a:t></a:r></a:p>`
    ).join('') || '<a:p><a:endParaRPr lang="en-US"/></a:p>';

    // accent bar under the title
    const accent = `<p:sp><p:nvSpPr><p:cNvPr id="9" name="accent"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${rtl ? (bodyX + bodyW - 900000) : bodyX}" y="1750000"/><a:ext cx="900000" cy="45000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
<a:solidFill><a:srgbClr val="22D3EE"/></a:solidFill></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`;

    const pic = hasImage
      ? `<p:pic><p:nvPicPr><p:cNvPr id="8" name="image"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="${imgX}" y="1500000"/><a:ext cx="${imgW}" cy="${imgW}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 6000"/></a:avLst></a:prstGeom></p:spPr></p:pic>`
      : '';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${textShape({ id: 2, name: 'title', x: bodyX, y: 900000, cx: bodyW, cy: 800000, paras: titlePara })}
${accent}
${textShape({ id: 3, name: 'body', x: bodyX, y: 2100000, cx: bodyW, cy: 3800000, paras: bulletParas })}
${pic}
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  }

  function buildPptx(slides) {
    const files = [];
    const n = slides.length;

    const overrides = slides.map((s, i) =>
      `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');

    files.push({ name: '[Content_Types].xml', data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${overrides}</Types>` });

    files.push({ name: '_rels/.rels', data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>` });

    const sldIds = slides.map((s, i) =>
      `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');

    files.push({ name: 'ppt/presentation.xml', data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${sldIds}</p:sldIdLst>
<p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="${H}" cy="${W}"/>
</p:presentation>` });

    const presRels = [
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
      ...slides.map((s, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`),
      `<Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`
    ].join('');
    files.push({ name: 'ppt/_rels/presentation.xml.rels', data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels}</Relationships>` });

    files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: SLIDE_MASTER });
    files.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>` });

    files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: SLIDE_LAYOUT });
    files.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>` });

    files.push({ name: 'ppt/theme/theme1.xml', data: THEME });

    slides.forEach((s, i) => {
      const hasImage = !!(s.imageBytes && s.imageBytes.length);
      files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: slideXml(s, hasImage) });
      const relParts = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'];
      if (hasImage) {
        relParts.push(`<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${i + 1}.jpg"/>`);
        files.push({ name: `ppt/media/image${i + 1}.jpg`, data: s.imageBytes });
      }
      files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data:
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relParts.join('')}</Relationships>` });
    });

    return Zip.build(files);
  }

  return { buildDocx, buildPptx, isRtlText };
})();
