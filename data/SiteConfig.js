const config = {
  siteTitle: 'Charles Feng',
  siteTitleShort: 'Charles Feng',
  siteTitleAlt: 'Charles Feng',
  siteLogo: '/logos/logo-1024.png',
  siteUrl: 'https://charlesfeng.cn',
  profileUrl: 'https://images.charlesfeng.cn/profile.jpg',
  profileAlt: 'CharlesFengProfile',
  faviconUrl: 'https://resources.charlesfeng.cn/favicon.ico',
  repo: 'https://github.com/CharlesFeng47/charlesfeng.cn',
  pathPrefix: '',
  // dateFromFormat: 'YYYY-MM-DD',
  dateFormat: 'YYYY-MM-DD',
  siteDescription:
    'Hello, this\'s Charles Feng.',
  siteRss: '/rss.xml',
  googleAnalyticsID: 'GT-M63L65L',
  // userName: 'Charles',
  // userEmail: '',
  // userTwitter: '',
  menuLinks: [
    {
      name: 'Articles',
      link: '/blog/',
    },
    // {
    //   name: 'Categories',
    //   link: '/categories/',
    // },
    {
      name: 'Tags',
      link: '/tags/',
    },
    {
      name: 'About me',
      link: '/me/',
    },
  ],
  themeColor: '#3F80FF', // Used for setting manifest and progress theme colors.
  backgroundColor: '#ffffff',
}

// Make sure pathPrefix is empty if not needed
if (config.pathPrefix === '/') {
  config.pathPrefix = ''
} else {
  // Make sure pathPrefix only contains the first forward slash
  config.pathPrefix = `/${config.pathPrefix.replace(/^\/|\/$/g, '')}`
}

// Make sure siteUrl doesn't have an ending forward slash
if (config.siteUrl.substr(-1) === '/') config.siteUrl = config.siteUrl.slice(0, -1)

// Make sure siteRss has a starting forward slash
if (config.siteRss && config.siteRss[0] !== '/') config.siteRss = `/${config.siteRss}`

module.exports = config