import React, { Component } from 'react'
import { Link } from 'gatsby'
import ThemeContext from '../context/ThemeContext'

// github
const github = 'https://cdn.charlesfeng.top/resources/github.png'
const githubDark = 'https://cdn.charlesfeng.top/resources/github-dark.png'
const githubActions = 'https://cdn.charlesfeng.top/resources/github-actions.svg'

// // travis
// const travisPhotoNum = 2;
// const travisIndex = Math.floor(Math.random() * travisPhotoNum) + 1; // 从 1 开始编号
// const travis = 'https://cdn.charlesfeng.top/resources/travis-ci-pride-' + travisIndex + '.svg';

// gatsby
const gatsby = 'https://cdn.charlesfeng.top/resources/gatsby.png';

export default class Footer extends Component {
  static contextType = ThemeContext // eslint-disable-line

  render() {
    const theme = this.context
    return (
      <footer className="footer container">
        <div>
          {/* <Link to="/newsletter">Newsletter</Link> */}
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">
            渝ICP备18013709号-4
          </a>
          <a href="https://weibo.com/u/7761932948/" target="_blank" rel="noopener noreferrer">
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
          <a href="https://github.com/CharlesFeng47/charlesfeng.cn" title="Open-source on GitHub">
            <img
              src={theme.dark ? githubDark : github}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-img"
              alt="GitHub"
            />
          </a>
          <a href="https://github.com/CharlesFeng47/charlesfeng.cn/actions" title="CI/CD by GitHub Actions">
            <img
              src={githubActions}
              target="_blank"
              rel="noopener noreferrer"
              className="footer-img"
              alt="GitHub Actions"
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