# 薪资计算器的搜索发现与收录

主网址：https://mx-pai.cn/salary-calculator/

说明页：https://mx-pai.cn/salary-calculator/guide/

站点地图：https://mx-pai.cn/salary-calculator/sitemap.xml

## 已有的页面配置

首页和说明页均提供静态 HTML 标题、描述、中文语言标记、唯一 canonical 网址，以及双向可抓取的普通链接。说明页的收入计算口径、使用边界和政策来源直接写在 HTML 中

首页提供真实功能对应的 WebApplication 结构化数据，不添加虚构评分、评论或作者资质。页面未加入统计脚本，用户的薪资输入继续保存在浏览器本地

## 主站入口

2026-10-23 检查时，主站首页可访问，尚无计算器入口，域名根目录的 robots.txt 和 sitemap.xml 返回 404。缺少 robots.txt 本身不限制抓取，项目子目录下的 robots.txt 不作为整个域名的爬取规则生效

建议在主站仓库 mx-pai/mx-pai.github.io 中增加首页入口，并在根目录 robots.txt 声明站点地图。该仓库当前保存生成后的博客文件，下次重新生成博客时，应把菜单配置、robots.txt 和站点地图同步回博客源项目

对应改动已整理为[主站 PR #1](https://github.com/mx-pai/mx-pai.github.io/pull/1)，合并后随主站发布生效

## 提交与观察

登录站点所有者的 Google Search Console，添加网址前缀资源 https://mx-pai.cn/salary-calculator/，按控制台提供的方式验证所有权，提交上述站点地图，再通过网址检查查看首页和说明页的收录情况。验证标记必须来自该账号，不能自行生成或复用其他站点的标记

Bing Webmaster Tools 同样支持验证站点和提交站点地图。面向百度搜索时，可在百度搜索资源平台查看该站点账号当前可用的验证与提交能力

提交完成后，关注实际被发现和收录的网址、查询词、展现与点击。结合真实查询继续完善说明内容，例如「13 薪和年终奖怎么填」「为什么每月个税不同」「年薪和首年收入有什么差别」，每个新页面都应解决具体问题并提供计算器入口

更新正文或计算口径时再更新 sitemap 的 lastmod，避免把自动构建时间当作内容修改时间。Google 和 Bing 均不保证提交后立即收录或获得排名

## 官方参考

- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://developers.google.com/crawling/docs/robots-txt/create-robots-txt
- https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed
