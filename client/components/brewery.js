import React from 'react'
import axios from 'axios'
import Map from './brewery-map'

const GET_URL = (id) => `/api/v1/breweries/${id}`

class Root extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      breweries: [],
      isLoading: false
    }
    // this.getBeer = this.getBeer.bind(this)
  }

  getBrewery = () => {
    this.setState((s) => ({ isLoading: !s.isLoading }))
    axios(GET_URL(this.props.id)).then(({ data }) => {
      this.setState((s) => ({ breweries: data.data, isLoading: !s.isLoading }))
    })
  }

  componentDidMount() {
    if (this.props.id !== '') {
      this.getBrewery()
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.id !== prevProps.id) {
      this.getBrewery()
    }
  }

  render() {
    if (this.state.isLoading) return 'Updating...'
    if (this.props.id === '') return 'No beer - No brewery'
    return (
      <div>
        Hold my {this.state.breweries.map((it) => it.name).join(', ')} <br />
        <Map brews={this.state.breweries} id={this.props.id} />
      </div>
    )
  }
}

export default Root
