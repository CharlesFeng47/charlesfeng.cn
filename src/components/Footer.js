import React, { Component } from 'react'
import { Link } from 'gatsby'
import ThemeContext from '../context/ThemeContext'

// github
const github = 'https://resources.charlesfeng.cn/github.png'
const githubDark = 'https://resources.charlesfeng.cn/github-dark.png'
const githubActions = 'https://resources.charlesfeng.cn/github-actions.svg'

// // travis
// const travisPhotoNum = 2;
// const travisIndex = Math.floor(Math.random() * travisPhotoNum) + 1; // 从 1 开始编号
// const travis = 'https://resources.charlesfeng.cn/travis-ci-pride-' + travisIndex + '.svg';

// gatsby
const gatsby = 'https://resources.charlesfeng.cn/gatsby.png';

export default class Footer extends Component {
  static contextType = ThemeContext // eslint-disable-line

  render() {
    const theme = this.context
    return (
      <footer className="footer container">
        <div>
          {/* <Link to="/newsletter">Newsletter</Link> */}
          <a href="https://www.xiaohongshu.com/user/profile/5d1cacbe00000000160107f7" target="_blank" rel="noopener noreferrer">
            小红书/RedNote
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
