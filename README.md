# ✈️ charlesfeng.cn ![](https://api.travis-ci.com/CharlesFeng47/charlesfeng.cn.svg)
Personal website running on Gatsby, React, and Node.js, inspired by [Tania Rascia](https://github.com/taniarascia/taniarascia.com) and CI/CD by [Travis](https://travis-ci.com/).

## 🧬 Project Structure

In order to make the structure clearer, I will mark the **_directories_** in bold and italics and mark the **files** in just bold.

+ **_content_**: On Tania's original version (However, this part has been migrated to a private submodule, so you cannot seen it anymore. This [link](https://github.com/CharlesFeng47/charlesfeng.cn/tree/872c773f248e1586b12edbbf3dba18798e8fa85c) is my first commit in this repo and it's almost a copy of Tania's version when I started. It contains all the basic info and structures, so I think it might help if you wanna see its original version), there's another folder **_images_** under this folder, and it contains all the images in the posts, but I think, upload all the image files to GitHub is huge and time-wasting when cloning, so I upload image files to my cdn server and quote those in my posts.
  + **_pages_**: My page files, rendering by template [page](https://github.com/CharlesFeng47/charlesfeng.cn/blob/master/src/templates/page.js).
  + **_posts_**: My post files, rendering by template [post](https://github.com/CharlesFeng47/charlesfeng.cn/blob/master/src/templates/post.js).
  + **_thumbnails_**: Thumbnail images of my posts. As you can see what I did to the folder **_images_**, this folder will be removed and the thumbnail images will be transfered to the cdn server in the future. (But I ’m not sure how long this change would take, because the thumbnail sections in the blog's code are related to `sharp` which I'm not familiar with, and my local environment has broken with some strange configuration problem 🌚)
+ **_data_**
  + **SiteConfig.js**: Some basic info and configurations used to render the website and cited by other components for consistency. For more infomation, you can refer to the detail [configuration](https://github.com/Vagr9K/gatsby-advanced-starter#configuration).
  + **projects.js**: Preserving `My Projects` part's info on the website's index page.
+ **_defaulterror_**: This folder actually has nothing to do with this project. It contains the default 404 error interface on my cdn's root domain [charlesfeng.top](http://charlesfeng.top) for China's website filing (aka beian) validation, and I placed it here to make this error interface could be traced by Git and CI by travis.
+ **_src_**
  + **_components_**: Miscellaneous common components.
    + **Footer.js**: The blog's footer at the bottom.
    + **Navigation.js**: The blog's navigation bar at the top.
    + **PostListing.js**: Displaying the posts in a list, and it could be set with props `simple` which means just title and no date. Moreover, When rendering each post in this list, the component would determine whether set the flag on the right by some calculation.
      + Flag 'New': Comparing whether the date post published and the current date are within specific days. In my setting, it's a week.
      + Flag 'Popular': Examining whether the post's categories contains 'Popular'.
    + **PostTag.js**: Displaying the post's tags in a list.
    + **ProjectListing.js**: Displaying the projects in a list, and its data are stored in `/data/projects.js` as mentioned above.
    + **SEO.js**: It's some optimization for search engines.
    + **SimpleListing.js**: Displaying some info in a list. I don't use this component right now but might use it one day in the future, so I retain this file.
    + **UserInfo.js**: The author's file section at the bottom of the [PostTemplate](https://github.com/CharlesFeng47/charlesfeng.cn/blob/master/src/templates/post.js) which means it shows at the blog post's bottom.
  + **_context_**: As the folder's name says, it is related to the theme (dark / light).
  + **_fonts_**: Fonts making the designed 404 interface looks like a DOS system.
  + **_layout_**: The blog's overall structure, including the browser's `Helmet`, `Navigation` at the top, main area at the middle and `Footer` at the bottom.
  + **_pages_**: All components under this folder will be rendered to one specific page regardless of the conditions.
    + **404.js**: Blog's default 404 error interface.
    + **blog.js**: Posts' home interface and the url is `/blog`.
    + **categories.js**: Categories' home interface and the url is `/categories`.
    + **index.js**: Index interface and the url is `/`.
    + **tags.js**: Tags's home interface and the url is `/tags`.
  + **_styles_**
  + **_templates_**: All components under this folder will be rendered to the related page according to the condition, thus each component will be rendered to different pages based on the url. For example 🌰, the component `tag` will be rendered to page `/tags/cdn`, `tags/web`, etc. Related code can be found [here](https://github.com/CharlesFeng47/charlesfeng.cn/blob/master/gatsby-node.js#L102).
    + **category.js**: Category interface and the url is `/categories/${category}`.
    + **page.js**: Specific page interface and the url is `/${page-name}`.
    + **post.js**: Specific post interface and the url is `/${post-slug}`.
    + **tag.js**: Tag interface and the url is `/tags/${tag}`.
  + **_utils_**: Some common js function.
+ **_static_**: This folder contains a file **robot.txt** and this file will tell the search engines what needs to be crawled and what does not. It's kind of SEO. For more infomation, you can refer to [wiki](https://en.wikipedia.org/wiki/Robots_exclusion_standard).

## 💝 Acknowledgements

+ Tania Rascia - [taniarascia.com](https://github.com/taniarascia/taniarascia.com)
+ Ruben Harutyunyan - [Gatsby Advanced Starter](https://github.com/vagr9k/gatsby-advanced-starter/)

