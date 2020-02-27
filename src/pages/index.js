import React, { Component } from 'react'
import Helmet from 'react-helmet'
import GitHubButton from 'react-github-btn'
import { graphql, Link } from 'gatsby'
import Layout from '../layout'
import PostListing from '../components/PostListing'
import ProjectListing from '../components/ProjectListing'
import SimpleListing from '../components/SimpleListing'
import SEO from '../components/SEO'
import config from '../../data/SiteConfig'
import projects from '../../data/projects'
import podcasts from '../../data/podcasts'
import tania from '../../content/images/profile.jpg'

export default class Index extends Component {
  render() {
    const { data } = this.props

    const latestPostEdges = data.latest.edges
    const popularPostEdges = data.popular.edges

    return (
      <Layout>
        <Helmet title={`${config.siteTitle} – Stay Hungry, Stay Foolish.`} />
        <SEO />
        <div className="container">
          <div className="lead">
            <div className="elevator">
              <h1>{`Hello, I'm Charles.`}</h1>
              <p>
                冯俊杰，南京大学软件学院 2019 级研究生在读。
              </p>
              <p>
                悟已往之不谏，知来者之可追。实迷途其未远，觉今是而昨非。希望每天都能进步一点点。(*ˉ︶ˉ*)
              </p>
              {/* <div className="social-buttons">
                <a
                  className="patreon"
                  href="https://www.patreon.com/taniarascia"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Patreon
                </a>
                <GitHubButton
                  href="https://github.com/CharlesFeng47"
                  data-size="large"
                  data-show-count="true"
                >
                  CharlesFeng
                </GitHubButton>
              </div> */}
            </div>
            <div className="newsletter-section">
              <img src={tania} className="newsletter-avatar" alt="Tania" />
              <h3>求 Follow</h3>
              <p>
                绝对不是穿格子衫的程序员！
              </p>
              <GitHubButton
                href="https://github.com/CharlesFeng47"
                data-size="large"
                data-show-count="true"
              >
                CharlesFeng
             </GitHubButton>
            </div>
          </div>
        </div>

        <div className="container front-page">
          <section className="section">
            <h2>
              Latest Articles
              <Link to="/blog" className="view-all">
                View all
              </Link>
            </h2>
            <PostListing simple postEdges={latestPostEdges} />
          </section>

          <section className="section">
            <h2>
              Most Popular
              <Link to="/categories/popular" className="view-all">
                View all
              </Link>
            </h2>
            <PostListing simple postEdges={popularPostEdges} />
          </section>

          <section className="section">
            <h2>Open Source Projects</h2>
            <ProjectListing projects={projects} />
          </section>

          {/* <section className="section">
            <h2>Brodcasts</h2>
            <SimpleListing data={podcasts} />
          </section> */}
        </div>
      </Layout>
    )
  }
}

export const pageQuery = graphql`
  query IndexQuery {
    latest: allMarkdownRemark(
      limit: 6
      sort: { fields: [fields___date], order: DESC }
      filter: { frontmatter: { template: { eq: "post" } } }
    ) {
      edges {
        node {
          fields {
            slug
            date
          }
          excerpt
          timeToRead
          frontmatter {
            title
            tags
            categories
            thumbnail {
              childImageSharp {
                fixed(width: 150, height: 150) {
                  ...GatsbyImageSharpFixed
                }
              }
            }
            thumbnailRound
            date
            template
          }
        }
      }
    }
    popular: allMarkdownRemark(
      limit: 7
      sort: { fields: [fields___date], order: DESC }
      filter: { frontmatter: { categories: { eq: "Popular" } } }
    ) {
      edges {
        node {
          fields {
            slug
            date
          }
          excerpt
          timeToRead
          frontmatter {
            title
            tags
            categories
            thumbnail {
              childImageSharp {
                fixed(width: 150, height: 150) {
                  ...GatsbyImageSharpFixed
                }
              }
            }
            thumbnailRound
            date
            template
          }
        }
      }
    }
  }
`