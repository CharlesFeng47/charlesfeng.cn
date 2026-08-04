import urlJoin from 'url-join'
import moment from 'moment'
import config from '../../data/SiteConfig'

const formatDate = date => moment.utc(date).format(config.dateFormat)

const editOnGithub = post => {
  const date = moment.utc(post.date).format(config.dateFromFormat)
  return urlJoin(config.repo, '/blob/master/content/posts', `${date}-${post.slug}.md`)
}

// Prefer Gatsby's optimized image data, and keep the original file URL as a fallback for formats like SVG.
const getThumbnailData = (thumbnail, thumbnailEmoji = '') => {
  // Emoji input does not resolve to a File node `thumbnail`, so only the derived emoji value is available.
  if (!thumbnail) {
    return {
      optimizedImageData: null,
      publicUrl: '',
      emoji: thumbnailEmoji,
    }
  }

  // Image (PNG/JPEG) files use Sharp data when available; SVG and unsupported formats fall back to publicURL.
  return {
    optimizedImageData: thumbnail.childImageSharp ? thumbnail.childImageSharp.gatsbyImageData : null,
    publicUrl: thumbnail.publicURL || '',
    emoji: '',
  }
}

export { formatDate, editOnGithub, getThumbnailData }
