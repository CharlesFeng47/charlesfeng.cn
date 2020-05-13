import React, { Component } from 'react'
import Helmet from 'react-helmet'
import ThemeContext from '../context/ThemeContext'
import Navigation from '../components/Navigation'
import Footer from '../components/Footer'
import config from '../../data/SiteConfig'
import '../styles/main.scss'

export default class MainLayout extends Component {
  static contextType = ThemeContext

  render() {
    const { dark, notFound } = this.context
    const { children } = this.props
    let themeClass = ''

    if (dark && !notFound) {
      themeClass = 'dark'
    } else if (notFound) {
      themeClass = 'not-found'
    }

    return (
      <>
        <Helmet
          bodyAttributes={{
            class: `theme ${themeClass}`,
          }}
        >
          <meta name="description" content={config.siteDescription} />
          <link rel="icon" type="image/png" href={config.faviconUrl} />
        </Helmet>
        {/* <div id="wx" style={{position: "absolute", top: "0", left: "0", width: "80%", zIndex: "-1", opacity: "0"}}>
          <img src="https://cdn.charlesfeng.top/resources/wx-share-icon.png" />
        </div> */}
        <Navigation menuLinks={config.menuLinks} />
        <main id="main-content">
          {children}
        </main>
        <Footer />
      </>
    )
  }
}