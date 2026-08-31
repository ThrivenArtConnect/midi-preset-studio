import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(`ErrorBoundary [${this.props.name}]:`, error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '20px', color: '#ef4444' }}>
          <h3 style={{ margin: '0 0 8px' }}>Fehler in {this.props.name}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>{this.state.error.message}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
