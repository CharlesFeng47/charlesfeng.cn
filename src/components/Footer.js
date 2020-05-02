import React, { Component } from 'react'
import { Link } from 'gatsby'
import travis from '../images/travis-ci.png'
import gatsby from '../images/gatsby.png'
import github from '../images/github.png'
import githubDark from '../images/github-dark.png'
import ThemeContext from '../context/ThemeContext'

export default class Footer extends Component {
  static contextType = ThemeContext // eslint-disable-line

  render() {
    const theme = this.context
    return (
      <footer className="footer container">
        <div>
          {/* <Link to="/newsletter">Newsletter</Link> */}
          <a href="https://weibo.com/u/5708997053" target="_blank" rel="noopener noreferrer">
            Weibo
          </a>
          <a href="https://music.apple.com/cn/playlist/charles-fengs-favorites/pl.u-6mo414WcBZVzxD8" target="_blank" rel="noopener noreferrer">
            Apple Music Playlist
          </a>
          {/* <a href="https://space.bilibili.com/8298364/" target="_blank" rel="noopener noreferrer">
            bilibili
          </a> */}
          {/* <a href="http://www.dianping.com/member/853628010" target="_blank" rel="noopener noreferrer">
            dianping
          </a> */}
          {/* <a href="https://www.instagram.com/charlesfeng47" target="_blank" rel="noopener noreferrer">
            Instagram
          </a> */}
        </div>
        <div>
          <a href="https://github.com/CharlesFeng47" title="Open-source on GitHub">
            <img
              src={theme.dark ? githubDark : github}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-img"
              alt="GitHub"
            />
          </a>
          <a href="https://travis-ci.com/github/CharlesFeng47/charlesfeng.cn" title="CI by Travis">
            <img
              src={travis}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-img"
              alt="Travis"
            />
          </a>
          <a href="https://www.gatsbyjs.org/" title="Built with Gatsby">
            <img
              src={gatsby}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-img"
              alt="Gatsby.js"
            />
          </a>
        </div>
      </footer>
    )
  }
}