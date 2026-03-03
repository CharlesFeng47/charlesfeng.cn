import urlJoin from 'url-join'
import moment from 'moment'
import config from '../../data/SiteConfig'

const formatDate = date => moment.utc(date).format(config.dateFormat)

const editOnGithub = post => {
  const date = moment.utc(post.date).format(config.dateFromFormat)
  return urlJoin(config.repo, '/blob/master/content/posts', `${date}-${post.slug}.md`)
}

// Prefer Gatsby's optimized image data, but keep the original file url as a fallback for formats like SVG, which is not intented to be supported by gatsby-transformer-sharp.
const getThumbnailData = thumbnail => {
  if (!thumbnail) {
    return {
      optimizedImage: null,
      publicUrl: '',
    }
  }

  return {
    optimizedImage: thumbnail.childImageSharp ? thumbnail.childImageSharp.fixed : null,
    publicUrl: thumbnail.publicURL || '',
  }
}

export { formatDate, editOnGithub, getThumbnailData }
