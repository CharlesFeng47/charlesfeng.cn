import urlJoin from 'url-join'
import moment from 'moment'
import config from '../../data/SiteConfig'

const formatDate = date => moment.utc(date).format(config.dateFormat)

const editOnGithub = post => {
  const date = moment.utc(post.date).format(config.dateFromFormat)
  return urlJoin(config.repo, '/blob/master/content/posts', `${date}-${post.slug}.md`)
}

const getThumbnailData = thumbnail => {
  if (!thumbnail) {
    return {
      fixed: null,
      src: '',
    }
  }

  return {
    fixed: thumbnail.childImageSharp ? thumbnail.childImageSharp.fixed : null,
    src: thumbnail.publicURL || '',
  }
}

export { formatDate, editOnGithub, getThumbnailData }
