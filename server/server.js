import express from 'express'
import path from 'path'
import cors from 'cors'
import bodyParser from 'body-parser'
import sockjs from 'sockjs'
import { renderToStaticNodeStream } from 'react-dom/server'
import React from 'react'
import cookieParser from 'cookie-parser'
import passport from 'passport'
import jwt from 'jsonwebtoken'
import axios from 'axios'

import mongooseService from './services/mongoose'
import passportJWT from './services/passport.js'
import auth from './middleware/auth'

import config from './config'
import Html from '../client/html'
import User from './model/User.model'
import Channel from './model/Channel.model'
import Message from './model/Message.model'

const Root = () => ''

mongooseService.connect()

try {
  // eslint-disable-next-line import/no-unresolved
  // ;(async () => {
  //   const items = await import('../dist/assets/js/root.bundle')
  //   console.log(JSON.stringify(items))

  //   Root = (props) => <items.Root {...props} />
  //   console.log(JSON.stringify(items.Root))
  // })()
  console.log(Root)
} catch (ex) {
  console.log(' run yarn build:prod to enable ssr')
}

let connections = []

const port = process.env.PORT || 8090
const server = express()

const middleware = [
  cors(),
  passport.initialize(),
  express.static(path.resolve(__dirname, '../dist/assets')),
  bodyParser.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  bodyParser.json({ limit: '50mb', extended: true }),
  cookieParser()
]

passport.use('jwt', passportJWT.jwt)

middleware.forEach((it) => server.use(it))

const BASE_URL = 'https://sandbox-api.brewerydb.com/v2'
const API_KEY = '21553b7452d89999559dc51ef6b9815d'

const getBeerUrl = () => `${BASE_URL}/beer/random?key=${API_KEY}`
const getBreweryUrl = (id) => `${BASE_URL}/beer/${id}/breweries?key=${API_KEY}`
const getBreweryData = (id) => `${BASE_URL}/brewery/${id}/locations?key=${API_KEY}`

server.get('/api/v1/beer', (req, res) => {
  axios(getBeerUrl()).then(({ data }) => {
    res.json(data)
  })
})
server.get('/api/v1/breweries/:id', (req, res) => {
  axios(getBreweryUrl(req.params.id)).then(({ data }) => {
    res.json(data)
  })
})
server.get('/api/v1/breweries/locations/:id', (req, res) => {
  axios(getBreweryData(req.params.id)).then(({ data }) => {
    res.json(data)
  })
})
server.get('/api/v1/user-info', auth(['admin']), (req, res) => {
  res.json({ users: connections.map((t) => t.userInfo) })
})

server.get('/api/v1/test/cookies', (req, res) => {
  res.cookie('serverCookie', 'test', { maxAge: 90000, httpOnly: true })
  res.json({ status: res.cookies })
})

server.get('/api/v1/auth', async (req, res) => {
  try {
    const jwtUser = jwt.verify(req.cookies.token, config.secret)
    const user = await User.findById(jwtUser.uid)

    const payload = { uid: user.id }
    const token = jwt.sign(payload, config.secret, { expiresIn: '48h' })
    delete user.password
    res.cookie('token', token, { maxAge: 1000 * 60 * 60 * 48 })
    res.json({ status: 'ok', token, user })
  } catch (err) {
    console.log(err)
    res.json({ status: 'error', err })
  }
})

server.post('/api/v1/auth', async (req, res) => {
  console.log(req.body)
  try {
    const user = await User.findAndValidateUser(req.body)

    const payload = { uid: user.id }
    const token = jwt.sign(payload, config.secret, { expiresIn: '48h' })
    delete user.password
    res.cookie('token', token, { maxAge: 1000 * 60 * 60 * 48 })
    connections.forEach((c) => {
      c.write(JSON.stringify({ type: 'SHOW_MESSAGE', message: `${user.email} Just Logged In` }))
    })
    res.json({ status: 'ok', token, user })
  } catch (err) {
    console.log(err)
    res.json({ status: 'error', err })
  }
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const [htmlStart, htmlEnd] = Html({
  body: 'separator',
  title: 'Skillcrucial - Become an IT HERO'
}).split('separator')

server.get('/', (req, res) => {
  const appStream = renderToStaticNodeStream(<Root location={req.url} context={{}} />)
  res.write(htmlStart)
  appStream.pipe(res, { end: false })
  appStream.on('end', () => {
    res.write(htmlEnd)
    res.end()
  })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', async (conn) => {
    connections.push(conn)
    conn.on('data', async (data) => {
      const parsedData = JSON.parse(data)

      if (parsedData.type === 'TOGGLE_CHANNEL') {
        const newUser = await User.toggleChannel({
          email: conn.userInfo.email,
          channel: parsedData.channel
        })
        connections
          .filter((it) => typeof it.userInfo !== 'undefined')
          .filter((it) => it.userInfo.email === conn.userInfo.email)
          .forEach((cn) => {
            cn.write(JSON.stringify({ type: 'TOGGLE_CHANNEL', channels: newUser.channels }))
            cn.userInfo.channels = newUser.channels
          })
      }

      if (
        typeof parsedData.type !== 'undefined' &&
        ['ADD_NEW_CHANNEL', 'SEND_MESSAGE_TO_THE_CHANNEL'].includes(parsedData.type)
      ) {
        if (parsedData.currentChannel.indexOf('#') === 0) {
          connections
            .filter((cn) => {
              return cn?.userInfo?.channels?.includes(parsedData.currentChannel.slice(1))
            })
            .forEach((c) => {
              c.write(data)
            })
        }

        if (parsedData.currentChannel.indexOf('@') === 0) {
          connections
            .filter(
              (it) =>
                typeof it.userInfo !== 'undefined' && it.userInfo.email === conn.userInfo.email
            )
            .forEach((c) => {
              c.write(
                JSON.stringify({
                  ...parsedData
                })
              )
            })

          connections
            .filter(
              (it) =>
                typeof it.userInfo !== 'undefined' &&
                it.userInfo.email === parsedData.currentChannel.slice(1)
            )
            .forEach((c) => {
              c.write(
                JSON.stringify({
                  ...parsedData,
                  currentChannel: `@${conn.userInfo.email}`
                })
              )
            })
        }

        if (parsedData.type === 'ADD_NEW_CHANNEL') {
          const channel = new Channel()
          channel.name = parsedData.name
          await channel.save()
        }

        if (
          parsedData.type === 'SEND_MESSAGE_TO_THE_CHANNEL' &&
          parsedData.currentChannel.indexOf('#') === 0
        ) {
          const newObj = { ...parsedData, channel: parsedData.currentChannel.slice(1) }
          delete newObj.currentChannel
          const message = new Message(newObj)
          await message.save()
        }
      }

      if (parsedData.type === 'SYSTEM_WELCOME') {
        let user = await User.findOne({ email: parsedData.email })

        conn.userInfo = {
          email: parsedData.email,
          channels: user.channels
        }
        console.log(conn.userInfo)
        console.log(user)

        const users = connections
          .filter((it) => typeof it.userInfo !== 'undefined')
          .map((it) => it.userInfo.email)

        let channels = (await Channel.find({})).map((it) => it.name)
        const timespan = +new Date() - 1000 * 60 * 60 *48;

        let messagesDB = await Message.find({ $gt: { time: timespan } }).limit(10000)
        let messages = messagesDB
          .map((it) => {
            const obj = it.toObject()
            delete obj._id
            delete obj.__v
            return obj
          })
          .reduce((acc, rec) => {
            return {
              ...acc,
              [`#${rec.channel}`]:
                typeof acc[`#${rec.channel}`] !== 'undefined'
                  ? [...acc[`#${rec.channel}`], rec]
                  : [rec]
            }
          }, {})

        connections.forEach((c) => {
          c.write(JSON.stringify({ type: 'UPDATE_ALIVE_USERS', users }))
          c.write(JSON.stringify({ type: 'INITIALIZE_CHANNELS', channels, messages }))
        })
      }
    })

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
      const users = connections
        .filter((it) => typeof conn.userInfo !== 'undefined')
        .map((it) => conn.userInfo.email)

      connections.forEach((c) => {
        c.write(JSON.stringify({ type: 'UPDATE_ALIVE_USERS', users }))
      })
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
