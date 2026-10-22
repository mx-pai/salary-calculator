# 薪资计算器

一个纯前端的薪资计算器，用来估算税后月均到手、首年现金、年化总包和期权归属

在线页面：[薪资计算器](https://mx-pai.cn/salary-calculator/)

## 使用

打开 index.html 即可本地使用，也可以在项目目录运行 python3 -m http.server 8000，然后访问 http://localhost:8000

页面会把输入保存在当前浏览器的本地存储中，薪资数据不会发送到服务器

## 计算内容

- 税前月薪、固定发薪月数、年终奖、年度补贴和签字费
- 社保、公积金、专项附加扣除及年终奖计税方式
- 期权归属周期、首期等待期、行权价和估值情景
- 税后月均到手、含年终奖的年均到手、税后年现金、首年现金和年化税前总包

税后结果按居民个人年度综合所得估算。**税后月均到手**是经常性口径：固定薪酬（含多薪）摊到每月，不含年终奖与期权；**含年终奖年均到手**把年终奖计入后再摊到每月。基本减除费用（6 万元/年）与专项附加扣除都按**年度汇算全年**计，首年不满 12 个月时不做月度折算；社保与公积金是月度支出，仍按在职月份计。试用期工资差额只影响首年。

勾选常见缴费参数后，空白缴费基数按月薪、社保个人比例按 10.5%、公积金按 7%；关闭选项时需填写完整缴费基数和比例。实际金额会因城市缴费规则、个人扣除和工资单口径而异。期权估值不代表可变现收入

## 隐私

计算在浏览器本地完成，页面不接入分析脚本、广告或后端服务

## 字体

`fonts/` 下是两个自托管的子集字体，页面只加载这两个文件：

| 文件 | 来源 | 作用 |
|---|---|---|
| `plex-sans-subset.woff2` | IBM Plex Sans 3.201（可变 wght 100–700） | 西文、数字、`¥` 与千分位 |
| `noto-sans-sc-subset.woff2` | Noto Sans SC 2.004（可变 wght 100–900） | 中文与全角标点 |

两者都是**可变字重**，所以 400/500/600/700 四档字重都有真实字形，不依赖 `font-synthesis`。数字在两个字体里都原生等宽，金额在输入时不会左右抖动。

**子集是按页面当前文案裁的，改了文案要重新生成**，否则新字会回落到系统字体（页面不至于破版，但字形会突变）：

```bash
# 1. 重新收集字符集：页面源码里的全部文本（含 JS 里的界面文案）+ ASCII + 中文标点
#    见下方字符集说明，或直接用 python3 提取 index.html 的文本
# 2. 裁剪
pip install "fonttools[woff]" brotli
pyftsubset NotoSansSC.ttf --text-file=chars.txt --flavor=woff2 \
  --layout-features='kern,liga,clig,ccmp,locl,mark,mkmk,vert,vrt2,calt' \
  --no-hinting --desubroutinize --drop-tables+=FFTM,DSIG \
  --output-file=fonts/noto-sans-sc-subset.woff2
pyftsubset IBMPlexSans.ttf --text-file=chars.txt --flavor=woff2 \
  --layout-features='kern,liga,clig,ccmp,locl,mark,mkmk,calt,tnum,lnum,zero' \
  --no-hinting --desubroutinize --drop-tables+=FFTM,DSIG \
  --output-file=fonts/plex-sans-subset.woff2
```

字符集必须包含：页面全部可见文案（**包括 JS 里拼出来的提示语**）、ASCII 可打印字符、`¥ , . %`、中文标点与全角字符。漏掉 `¥` 或 `,` 会让金额掉到别的字体上，在结果卡里一眼可见
