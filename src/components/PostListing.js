import React, { Component } from 'react'
import { Link } from 'gatsby'
import { GatsbyImage } from 'gatsby-plugin-image'
import moment from 'moment'
import { formatDate, getThumbnailData } from '../utils/global'

export default class PostListing extends Component {
  getPostList() {
    const { postEdges } = this.props
    const postList = postEdges.map(postEdge => {
      return {
        path: postEdge.node.fields.slug,
        tags: postEdge.node.frontmatter.tags,
        thumbnail: postEdge.node.frontmatter.thumbnail,
        thumbnailRound: postEdge.node.frontmatter.thumbnailRound,
        title: postEdge.node.frontmatter.title,
        date: postEdge.node.fields.date,
        excerpt: postEdge.node.excerpt,
        timeToRead: postEdge.node.timeToRead,
        categories: postEdge.node.frontmatter.categories,
      }
    })
    return postList
  }

  render() {
    // only display title without date
    const { simple } = this.props
    const postList = this.getPostList()

    return (
      <section className={`posts ${simple ? 'simple' : ''}`}>
        {
          postList.map(post => {
            const { optimizedImageData, publicUrl } = getThumbnailData(post.thumbnail)

            const popular = post.categories.includes('Popular')
            const date = formatDate(post.date)
            const newest = moment(post.date) > moment().subtract(30, 'days')
            let thumbnailNode = <div />

            if (optimizedImageData) {
              thumbnailNode = <GatsbyImage image={optimizedImageData} alt="" className={post.thumbnailRound ? 'round' : ''} />
            } else if (publicUrl) {
              thumbnailNode = (
                <img
                  src={publicUrl}
                  alt=""
                  className={`thumbnail-image ${post.thumbnailRound ? 'round' : ''}`}
                  loading="lazy"
                />
              )
            }

            return (
              <Link to={post.path} key={post.title}>
                <div className="each">
                  {thumbnailNode}
                  <div className="each-list-item">
                    <h2>{post.title}</h2>
                    {
                      !simple && <div className="excerpt">{date}</div>
                    }
                  </div>
                  {
                    newest && (
                      <div className="alert">
                        <div className="new">New!</div>
                      </div>
                    )
                  }
                  {
                    popular && !simple && !newest && (
                      <div className="alert">
                        <div className="popular">Popular</div>
                      </div>
                    )
                  }
                </div>
              </Link>
            )
          })
        }
      </section>
    )
  }
}
