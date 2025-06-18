# ✈️ charlesfeng.cn ![](https://api.travis-ci.com/CharlesFeng47/charlesfeng.cn.svg)
Personal website running on Gatsby, React, and Node.js, inspired by [Tania Rascia](https://github.com/taniarascia/taniarascia.com) and CI/CD by [Travis](https://travis-ci.com/).

## 🧬 Project Structure

In order to make the structure clearer, I will mark the **_directories_** in bold and italics and mark the **files** in just bold.

+ **_content_**: In Tania's original version (which has since been migrated to a private submodule, so it's no longer visible), there was an **_images_** folder that stored all the images used by the posts. You can still refer to [this commit](https://github.com/CharlesFeng47/charlesfeng.cn/tree/872c773f248e1586b12edbbf3dba18798e8fa85c), which was my first in this repo and is almost a direct copy of Tania's original structure. It includes all the basic setup and content. To avoid bloating the GitHub repo and slowing down clones, I chose to host image files on my own server and reference them in the posts, rather than uploading them directly.
  + **_pages_**: Page files, rendering by template [page](https://github.com/CharlesFeng47/charlesfeng.cn/blob/master/src/templates/page.js).
  + **_posts_**: Post files, rendering by template [post](https://github.com/CharlesFeng47/charlesfeng.cn/blob/master/src/templates/post.js).
  + **_thumbnails_**: Thumbnail images of the posts. As you can see what I did to the folder **_images_**, this folder will be removed and the thumbnail images will be transfered to the self hosting image service in the future. However, I'm not sure how long this change will take, the thumbnail logic in the blog relies on `sharp`, which I'm totally unfamiliar with, and my local environment is currently broken with some strange configuration problem 🌚.
+ **_data_**
  + **SiteConfig.js**: Some basic info and configurations used to render the website and cited by other components for consistency. For more infomation, you can refer to the detail [configuration](https://github.com/Vagr9K/gatsby-advanced-starter#configuration).
  + **projects.js**: Preserving `My Projects` part's info on the website's index page.
+ **_defaulterror_**: This folder is actually unrelated to the project itself. It originally contained the default 404 error page for my CDN’s root domain [charlesfeng.top](http://charlesfeng.top), used for China’s website filing (aka beian 备案) validation. I kept it here so the error page could be version-controlled via Git and integrated into CI/CD. However, since I’ve abandoned the beian process due to the complexity and hassle, this page is no longer in use.
+ **_src_**
  + **_components_**: Miscellaneous common components.
    + **Footer.js**: The blog's footer at the bottom.
    + **Navigation.js**: The blog's navigation bar at the top.
    + **PostListing.js**: Rendering a list of blog posts. It could be set with property `simple`, which displays only the post titles without dates when enabled. When rendering each post, the component also determines whether to display a **flag** on the right side based on the following logic:
      + Flag 'New': Displayed if the post was published within the past 30 days.
      + Flag 'Popular': Displayed if the post's categories include `'Popular'`.
    + **PostTag.js**: Rendering a list of blog tags.
    + **ProjectListing.js**: Rendering a list of projects. The data are stored in `/data/projects.js` as mentioned above.
    + **SEO.js**: It's some optimization for search engines.
    + **SimpleListing.js**: Rendering a simple list. I’m not currently using this component, but it's kept in case it becomes useful in the future.
    + **UserInfo.js**: Renders the author's information section at the bottom of the blog post. It is used in the [PostTemplate](https://github.com/CharlesFeng47/charlesfeng.cn/blob/master/src/templates/post.js), so it appears at the end of each blog post.
  + **_context_**: As the folder's name says, it is related to the theme (dark / light).
  + **_fonts_**: Fonts making the designed 404 interface looks like a DOS system.
  + **_layout_**: The blog's overall structure, including the browser's `Helmet`, `Navigation` at the top, main area at the middle and `Footer` at the bottom.
  + **_pages_**: This folder contains all the top-level page components. Each file here corresponds to a specific route and is rendered directly based on its filename.
    + **404.js**: Custom 404 error page displayed when a route is not found.
    + **blog.js**: Blog post listing page via `/blog`.
    + **categories.js**: Category overview page via `/categories`.
    + **index.js**: Main landing page of the blog via `/`.
    + **tags.js**: Tag overview page via `/tags`.
  + **_styles_**: scss files.
  + **_templates_**: Components in this folder serve as dynamic templates that are rendered based on route parameters. Each component corresponds to a type of content and is used to generate multiple pages depending on the URL. For example 🌰, the `tag.js` component is used to render pages like `/tags/cdn`, `/tags/web`, etc. (See [gatsby-node.js, line 102](https://github.com/CharlesFeng47/charlesfeng.cn/blob/master/gatsby-node.js#L102) for the implementation.)
    + **category.js**: Renders category-specific pages, with URLs like `/categories/${category}`.
    + **page.js**: Renders static pages uner `/pages`, with URLs like `/${page-name}`.
    + **post.js**: Renders individual blog posts, with URLs like `/${post-slug}`.
    + **tag.js**: Renders tag-specific pages, with URLs like `/tags/${tag}`.
  + **_utils_**: Some common js function.

## 💝 Acknowledgements

+ Tania Rascia - [taniarascia.com](https://github.com/taniarascia/taniarascia.com)
+ Ruben Harutyunyan - [Gatsby Advanced Starter](https://github.com/vagr9k/gatsby-advanced-starter/)

