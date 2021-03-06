import React, { Component } from 'react'
import config from '../../data/SiteConfig'
import patreon from '../../content/thumbnails/patreon.png'
import kofi from '../../content/thumbnails/kofi.png'

export default class UserInfo extends Component {
  render() {
    return (
      <aside className="note">
        <div className="container note-container">
          <div className="flex-author">
            <div className="flex-avatar">
              <img className="avatar" src={config.profileUrl} alt={config.profileAlt} />
            </div>
            <div>
              <p>
                希望有帮到您（≧∇≦）
              </p>

              <div className="flex">
                {/* TODO Buy me a coffee */}
                {/* <a
                  href="https://ko-fi.com/taniarascia"
                  className="donate-button"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img src={kofi} className="coffee-icon" alt="Coffee icon" />
                  Buy me a coffee
                </a> */}
                {/* <a
                  className="patreon-button"
                  href="https://www.patreon.com/taniarascia"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img src={patreon} height="50" width="50" alt="Patreon" /> Become a Patron
                </a> */}
              </div>
            </div>
          </div>
        </div>
      </aside>
    )
  }
}