(function (root) {
  "use strict";
  const palettes = {
    paper: { paper: "#fcfaf3", ink: "#292c25", muted: "#828374", line: "#c5c8b8", accent: "#627356", tag: "#e5e9da" },
    thermal: { paper: "#fffdf4", ink: "#303229", muted: "#858577", line: "#adaf9f", accent: "#565d4d", tag: "#edeee4" }
  };
  function metadata(_report, date = new Date()) {
    const day = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")];
    return { date: day.join(".") };
  }
  function render(report, { style = "paper", fontFamily = '"Plex Sub", "Noto Sub", sans-serif', monoFontFamily = '"Menlo", "Consolas", "Noto Sub", "PingFang SC", monospace', meta = metadata(report) } = {}) {
    const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    const p = palettes[style] || palettes.paper, thermal = style === "thermal";
    const paperWidth = 740, inset = 64, right = paperWidth - inset, content = paperWidth - inset * 2;
    const font = (size, weight = 400, numeric = false) => { ctx.font = `${weight} ${size}px ${numeric && thermal ? monoFontFamily : fontFamily}`; };
    const wrap = (value, size, max = content) => {
      font(size); const lines = []; let line = "";
      for (const char of value) {
        if (ctx.measureText(line + char).width > max && line) { lines.push(line); line = char; } else line += char;
      }
      if (line) lines.push(line); return lines;
    };
    const captions = wrap(report.headline.caption, 17);
    const notes = report.notes.flatMap(note => wrap(note, 17));
    const captionTop = report.headline.secondary ? 342 : 306;
    const kpiTop = captionTop + captions.length * 26 + 28;
    const rowsTop = kpiTop + 156;
    const rowsHeight = report.rows.length * 52;
    const deductionTop = rowsTop + rowsHeight + 18;
    const deductionHeight = report.deductions.reduce((sum, row) => sum + (row.detail ? 68 : 51), 0);
    const totalsTop = deductionTop + deductionHeight + 29;
    const notesTop = totalsTop + 128;
    const paperHeight = notesTop + notes.length * 27 + 132;
    const paddingX = 0, paddingY = 0;
    const width = paperWidth + paddingX * 2, height = paperHeight + paddingY * 2;
    canvas.width = width * 2; canvas.height = height * 2; ctx.scale(2, 2);
    ctx.save(); ctx.translate(paddingX, paddingY);
    const paperPath = () => {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(paperWidth, 0); ctx.lineTo(paperWidth, paperHeight - 10);
      const teeth = thermal ? 58 : 46, step = paperWidth / teeth;
      for (let i = teeth - 1; i >= 0; i--) ctx.lineTo(i * step, paperHeight - (i % 2 ? 9 : 0));
      ctx.closePath();
    };
    paperPath(); ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.shadowOffsetX = 0; ctx.clip();
    // Seeded fibres give a subtle paper grain while preserving crisp, selectable source text in the web preview
    let seed = thermal ? 41 : 73;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
    ctx.fillStyle = thermal ? "#77776008" : "#83826a0b";
    for (let i = 0; i < paperWidth * paperHeight / 90; i++) ctx.fillRect(random() * paperWidth, random() * paperHeight, .5 + random(), .5 + random());
    if (!thermal) {
      ctx.strokeStyle = "#8c8a730a"; ctx.lineWidth = .65;
      for (let i = 0; i < 430; i++) { const x = random() * paperWidth, y = random() * paperHeight; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 12, y + random() * 3); ctx.stroke(); }
    }
    const text = (value, x, y, size = 22, color = p.ink, weight = 400, align = "left", numeric = false) => {
      font(size, weight, numeric); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "alphabetic"; ctx.fillText(value, x, y);
    };
    const fitted = (value, x, y, size, max, color, weight = 500, align = "left", numeric = true) => {
      font(size, weight, numeric); while (ctx.measureText(value).width > max && size > 16) font(--size, weight, numeric);
      text(value, x, y, size, color, weight, align, numeric);
    };
    const rule = (y, solid = false) => { ctx.save(); ctx.strokeStyle = p.line; ctx.lineWidth = 1.2; ctx.setLineDash(solid ? [] : [5, 5]); ctx.beginPath(); ctx.moveTo(inset, y); ctx.lineTo(right, y); ctx.stroke(); ctx.restore(); };
    text("薪酬估算单", paperWidth / 2, 75, 32, p.ink, 500, "center");
    font(16); const tagWidth = ctx.measureText(report.tag).width + 24;
    ctx.fillStyle = p.tag; ctx.fillRect((paperWidth - tagWidth) / 2, 94, tagWidth, 28);
    text(report.tag, paperWidth / 2, 114, 16, p.accent, 400, "center");
    text(meta.date, inset, 154, 17, p.muted, 400, "left", thermal);
    text("人民币 / 年度估算", right, 154, 17, p.muted, 400, "right");
    rule(177);
    text(report.headline.label, paperWidth / 2, 218, 21, p.muted, 400, "center");
    fitted(report.headline.value, paperWidth / 2, 292, report.headline.pending ? 43 : 80, content, p.ink, thermal ? 600 : 500, "center");
    if (report.headline.secondary) text(report.headline.secondary, paperWidth / 2, 329, 20, p.accent, 400, "center");
    captions.forEach((line, i) => text(line, paperWidth / 2, captionTop + 17 + i * 26, 17, p.muted, 400, "center"));
    rule(kpiTop);
    report.kpis.forEach((item, i) => {
      const x = i === 0 ? inset : right, align = i === 0 ? "left" : "right";
      text(item.label, x, kpiTop + 36, 18, p.muted, 400, align);
      fitted(item.value, x, kpiTop + 78, 34, content / 2 - 12, p.ink, 500, align);
    });
    rule(kpiTop + 103);
    text("全年收入明细", inset, rowsTop - 12, 20, p.ink, 500);
    text("税前", right, rowsTop - 12, 17, p.muted, 400, "right");
    report.rows.forEach((item, i) => {
      const y = rowsTop + 31 + i * 52;
      text(item.label, inset, y, 21, p.ink);
      if (item.detail) { font(21); const labelWidth = ctx.measureText(item.label).width; text(item.detail, inset + labelWidth + 12, y, 16, p.muted); }
      fitted(item.value, right, y, 25, content / 2, p.ink, 400, "right");
    });
    rule(deductionTop);
    let deductionY = deductionTop + 35;
    report.deductions.forEach(item => {
      text(item.label, inset, deductionY, 21, p.ink); fitted(item.value, right, deductionY, 25, content / 2, p.ink, 400, "right");
      if (item.detail) text(item.detail, inset, deductionY + 23, 16, p.muted);
      deductionY += item.detail ? 68 : 51;
    });
    rule(totalsTop);
    report.firstYear.forEach((item, i) => { const y = totalsTop + 41 + i * 40; text(item.label, inset, y, 19, p.muted); fitted(item.value, right, y, 24, content / 2, p.ink, 400, "right"); });
    rule(notesTop - 19);
    notes.forEach((note, i) => text(note, inset, notesTop + i * 27, 17, p.muted));
    ctx.strokeStyle = p.accent; ctx.lineWidth = 1.1;
    ctx.strokeRect(paperWidth / 2 - 27, paperHeight - 103, 54, 54);
    text(report.signature.slice(0, 2), paperWidth / 2, paperHeight - 80, 20, p.accent, 400, "center");
    text(report.signature.slice(2), paperWidth / 2, paperHeight - 57, 20, p.accent, 400, "center");
    text("mx-pai.cn/salary-calculator", paperWidth / 2, paperHeight - 24, 15, p.muted, 400, "center", thermal);
    ctx.restore(); return canvas;
  }
  root.SalaryImage = { render, metadata };
})(typeof globalThis === "object" ? globalThis : this);
