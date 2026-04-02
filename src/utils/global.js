import urlJoin from 'url-join'
import moment from 'moment'
import config from '../../data/SiteConfig'

const formatDate = date => moment.utc(date).format(config.dateFormat)

const editOnGithub = post => {
  const date = moment.utc(post.date).format(config.dateFromFormat)
  return urlJoin(config.repo, '/blob/master/content/posts', `${date}-${post.slug}.md`)
}

// Prefer Gatsby's optimized image data, and keep the original file URL as a fallback for formats like SVG.
const getThumbnailData = thumbnail => {
  if (!thumbnail) {
    return {
      optimizedImageData: null,
      publicUrl: '',
    }
  }

  return {
    optimizedImageData: thumbnail.childImageSharp ? thumbnail.childImageSharp.gatsbyImageData : null,
    publicUrl: thumbnail.publicURL || '',
  }
}

export { formatDate, editOnGithub, getThumbnailData }
