import React, { Component } from 'react'
import Helmet from 'react-helmet'
import { graphql } from 'gatsby'
import Img from 'gatsby-image'
import Layout from '../layout'
import UserInfo from '../components/UserInfo'
import PostTags from '../components/PostTags'
import SEO from '../components/SEO'
import config from '../../data/SiteConfig'
import { formatDate, editOnGithub, getThumbnailData } from '../utils/global'

export default class PostTemplate extends Component {
  constructor(props) {
    super(props)

    this.state = {
      error: false,
    }
  }

  render() {
    const { comments, error } = this.state
    const { slug } = this.props.pageContext
    const postNode = this.props.data.markdownRemark
    const post = postNode.frontmatter

    const popular = postNode.frontmatter.categories.find(category => category === 'Popular')

    if (!post.id) {
      post.id = slug
    }

    const { optimizedImage, publicUrl } = getThumbnailData(post.thumbnail)
    const hasThumbnail = Boolean(optimizedImage || publicUrl)

    const date = formatDate(post.date)
    const githubLink = editOnGithub(post)
    const twitterShare = `http://twitter.com/share?text=${encodeURIComponent(post.title)}
    &url=${config.siteUrl}/${post.slug}/&via=taniarascia`

    return (
      <Layout>
        <Helmet>
          <title>{`${post.title} – ${config.siteTitle}`}</title>
        </Helmet>
        <SEO postPath={slug} postNode={postNode} postSEO />
        <article className="single container">
          <header className={`single-header ${!hasThumbnail ? 'no-thumbnail' : ''}`}>
            {
              optimizedImage
                ? <Img fixed={optimizedImage} className={post.thumbnailRound ? 'round' : ''} />
                : publicUrl && (
                  <img
                    src={publicUrl}
                    alt=""
                    className={`thumbnail-image ${post.thumbnailRound ? 'round' : ''}`}
                    loading="eager"
                  />
                )
            }
            <div className="flex">
              <h1>{post.title}</h1>
              <div className="post-meta">
                <time className="date">{date}</time>
                {/* /
                <a
                  className="twitter-link"
                  href={twitterShare}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Share
                </a>
                /
                <a
                  className="github-link"
                  href={githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Edit ✏️
                </a> */}
              </div>
              <PostTags tags={post.tags} />
            </div>
          </header>

          <div className="post" dangerouslySetInnerHTML={{ __html: postNode.html }} />
        </article>
        <UserInfo config={config} />
      </Layout>
    )
  }
}

/* eslint no-undef: "off" */
export const pageQuery = graphql`
  query BlogPostBySlug($slug: String!) {
    markdownRemark(fields: { slug: { eq: $slug } }) {
      html
      timeToRead
      excerpt
      frontmatter {
        title
        thumbnail {
          publicURL
          childImageSharp {
            fixed(width: 150, height: 150) {
              ...GatsbyImageSharpFixed
            }
          }
        }
        thumbnailRound
        slug
        date
        categories
        tags
        template
      }
      fields {
        slug
        date
      }
    }
  }
`
