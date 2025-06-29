const urlJoin = require('url-join').default
const config = require('./data/SiteConfig')

const siteUrl = urlJoin(config.siteUrl, config.pathPrefix)

module.exports = {
  pathPrefix: config.pathPrefix === '' ? '/' : config.pathPrefix,
  siteMetadata: {
    siteUrl, // used by gatsby-plugin-sitemap
  //   rssMetadata: {
  //     site_url: urlJoin(config.siteUrl, config.pathPrefix),
  //     feed_url: urlJoin(config.siteUrl, config.pathPrefix, config.siteRss),
  //     title: config.siteTitle,
  //     description: config.siteDescription,
  //     image_url: `${urlJoin(config.siteUrl, config.pathPrefix)}/logos/logo-48.png`,
  //   },
  },
  plugins: [
    'gatsby-plugin-sass',
    'gatsby-plugin-react-helmet',
    {
      resolve: `gatsby-plugin-netlify`,
      options: {
        headers: {
          '/*.js': ['cache-control: public, max-age=31536000, immutable'],
          '/*.css': ['cache-control: public, max-age=31536000, immutable'],
          '/sw.js': ['cache-control: public, max-age=0, must-revalidate'],
        },
      },
    },
    // {
    //   resolve: 'gatsby-source-filesystem',
    //   options: {
    //     name: 'assets',
    //     path: `${__dirname}/static/`,
    //   },
    // },
    {
      resolve: 'gatsby-source-filesystem',
      options: {
        name: 'posts',
        path: `${__dirname}/content/`,
      },
    },
    {
      resolve: 'gatsby-transformer-remark',
      options: {
        plugins: [
          {
            resolve: 'gatsby-remark-images',
            options: {
              maxWidth: 850,
            },
          },
          'gatsby-remark-prismjs',
          'gatsby-remark-copy-linked-files',
          {
            resolve: `gatsby-remark-autolink-headers`,
            options: {
              offsetY: `100`,
              maintainCase: false,
              removeAccents: true,
              icon: false,
              isIconAfterHeader: false,
            },
          },
        ],
      },
    },
    {
      resolve: 'gatsby-plugin-google-gtag',
      options: {
        trackingIds: [
          config.googleAnalyticsID,
        ],
      },
    },
    {
      resolve: 'gatsby-plugin-nprogress',
      options: {
        color: config.themeColor,
      },
    },
    'gatsby-plugin-sharp',
    `gatsby-transformer-sharp`,
    'gatsby-plugin-catch-links',
    {
      resolve: 'gatsby-plugin-sitemap', // Do not upgrade to versions >= 4.0.0 as the generated file will be sitemap-index.xml
      options: {
        exclude: [
          `/resume*`,
        ],
      }
    },
    {
      resolve: 'gatsby-plugin-robots-txt',
      options: {
        sitemap: `${urlJoin(siteUrl, "/sitemap.xml")}`,
      }
    },
    {
      resolve: 'gatsby-plugin-manifest',
      options: {
        name: config.siteTitle,
        short_name: config.siteTitleShort,
        description: config.siteDescription,
        start_url: config.pathPrefix,
        background_color: config.backgroundColor,
        theme_color: config.themeColor,
        display: 'minimal-ui',
        icons: [
          {
            src: '/logos/logo-48.png',
            sizes: '48x48',
            type: 'image/png',
          },
          {
            src: '/logos/logo-1024.png',
            sizes: '1024x1024',
            type: 'image/png',
          },
        ],
      },
    },
    // {
    //   resolve: 'gatsby-plugin-feed',
    //   options: {
    //     setup(ref) {
    //       const ret = ref.query.site.siteMetadata.rssMetadata
    //       ret.allMarkdownRemark = ref.query.allMarkdownRemark
    //       ret.generator = 'Charles Feng'
    //       return ret
    //     },
    //     query: `
    //     {
    //       site {
    //         siteMetadata {
    //           rssMetadata {
    //             site_url
    //             feed_url
    //             title
    //             description
    //             image_url
    //           }
    //         }
    //       }
    //     }
    //   `,
    //     feeds: [
    //       {
    //         serialize(ctx) {
    //           const { rssMetadata } = ctx.query.site.siteMetadata
    //           return ctx.query.allMarkdownRemark.edges.map(edge => ({
    //             categories: edge.node.frontmatter.tags,
    //             date: edge.node.fields.date,
    //             title: edge.node.frontmatter.title,
    //             description: edge.node.excerpt,
    //             url: rssMetadata.site_url + edge.node.fields.slug,
    //             guid: rssMetadata.site_url + edge.node.fields.slug,
    //             custom_elements: [
    //               { 'content:encoded': edge.node.html },
    //               { author: config.userEmail },
    //             ],
    //           }))
    //         },
    //         query: `
    //         {
    //           allMarkdownRemark(
    //             limit: 1000
    //             sort: { fields: { date: DESC } }
    //             filter: { frontmatter: { template: { eq: "post" } } }
    //           ) {
    //             edges {
    //               node {
    //                 excerpt(pruneLength: 180)
    //                 html
    //                 timeToRead
    //                 fields {
    //                   slug
    //                   date
    //                 }
    //                 frontmatter {
    //                   title
    //                   date
    //                   categories
    //                   tags
    //                   template
    //                 }
    //               }
    //             }
    //           }
    //         }
    //       `,
    //         output: config.siteRss,
    //         title: 'Charles Feng - RSS Feed',
    //       },
    //     ],
    //   },
    // },
  ],
}