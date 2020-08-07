import React from 'react'
import axios from 'axios'
import GoogleMapReact from 'google-map-react'

const GET_URL = (id) => `/api/v1/breweries/locations/${id}`
const IMAGE_URL = 'https://d29fhpw069ctt2.cloudfront.net/icon/image/85085/preview.svg'

class BrewMap extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      breweries: [],
      isLoading: false
    }
    // this.getBeer = this.getBeer.bind(this)
  }

  getLocations = () => {
    this.setState((s) => ({ isLoading: !s.isLoading }))
    Promise.all(
      this.props.brews.map((brew) =>
        axios(GET_URL(brew.id)).then(({ data }) => {
          return data.data
        })
      )
    ).then((data) => {
      this.setState((s) => ({ breweries: data.flat(), isLoading: !s.isLoading }))
    })
  }

  renderMarkers = (map, maps) => {
    const image = {
      url: IMAGE_URL,
      // This marker is 20 pixels wide by 32 pixels high.
      size: new maps.Size(20, 32)
    }

    this.state.breweries.forEach((it) => {
      const marker = new maps.Marker({
        position: { lat: it.latitude, lng: it.longitude },
        map,
        title: it.name,
        icon: image
      })
      return marker
    })
  }

  componentDidMount() {
    if (this.props.brews.length !== 0) {
      this.getLocations()
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.id !== prevProps.id) {
      this.getLocations()
    }
  }

  render() {
    if (this.state.isLoading) return 'Updating...'
    if (this.props.brews.length === 0) return 'No brewery - No Location'
    if (this.state.breweries.length === 0) return 'No locations'
    const center = [this.state.breweries[0].latitude, this.state.breweries[0].longitude]
    const zoom = 11
    return (
      <div id="mapid" className="container">
        <div className="w-full h-64 mt-24">
          <GoogleMapReact
            bootstrapURLKeys={{ key: 'AIzaSyCwJQEhxXYI1-ZTz8YKEgwGbZC1NPh5XWA' }}
            defaultCenter={center}
            defaultZoom={zoom}
            onGoogleApiLoaded={({ map, maps }) => this.renderMarkers(map, maps)}
            yesIWantToUseGoogleMapApiInternals
          />
        </div>
      </div>
    )
  }
}

export default BrewMap
