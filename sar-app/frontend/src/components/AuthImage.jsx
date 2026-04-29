import { useEffect, useState } from 'react'
import { fetchImageBlobUrl } from '../api/client'

export default function AuthImage({ imageId, alt = '' }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let cancelled = false
    let urlToRevoke = null
    fetchImageBlobUrl(imageId)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u)
        } else {
          urlToRevoke = u
          setUrl(u)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke)
    }
  }, [imageId])
  if (!url) return <div style={{ height: 160, background: '#0b1220' }} />
  return <img src={url} alt={alt} />
}
