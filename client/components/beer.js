import React from 'react'
import axios from 'axios'
import Brewery from './brewery'

const URL = '/api/v1/beer'

class Root extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      type: 'beer',
      beerName: '',
      id: ''
    }
    // this.getBeer = this.getBeer.bind(this)
  }

  getBeer = () => {
    axios(URL).then(({ data }) => {
      this.setState({ beerName: data.data.name, id: data.data.id })
    })
  }

  componentDidMount() {
    this.getBeer()
  }

  render() {
    return (
      <div>
        Hold my {this.state.type}, {this.state.beerName} <br />
        <Brewery id={this.state.id} /> <br />
        <button type="button" onClick={this.getBeer}>
          Refresh
        </button>
      </div>
    )
  }
}

export default Root
