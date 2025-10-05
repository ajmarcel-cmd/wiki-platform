'use client'

interface GameAsset {
  image: string
  games: string
  description: string
}

interface GameGalleryProps {
  title: string
  generation: string
  assets: GameAsset[]
  color: string
  bordercolor: string
}

export default function GameGallery({ title, generation, assets, color, bordercolor }: GameGalleryProps) {
  const containerStyle = {
    fontSize: '80%',
    margin: 'auto',
    textAlign: 'center' as const,
    borderRadius: '20px',
    border: `2px solid #${bordercolor}`,
    backgroundColor: `#${color}`,
    color: '#000',
    overflow: 'hidden'
  }

  const headerStyle = {
    borderRadius: '20px',
    border: `2px solid #${bordercolor}`,
    backgroundColor: `#${bordercolor}`,
    fontSize: '125%',
    color: 'white',
    padding: '0.5em',
    margin: 0
  }

  const imageStyle = {
    borderRadius: '20px',
    border: `2px solid #${bordercolor}`,
    backgroundColor: `#${color}`,
    overflow: 'hidden',
    padding: '0.5em'
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <strong>{generation}</strong>
      </div>
      {assets.map((asset, index) => (
        <div key={index} style={imageStyle}>
          <img 
            src={asset.image} 
            alt={asset.description}
            style={{ 
              maxWidth: '100%', 
              height: 'auto',
              display: 'block',
              margin: '0 auto'
            }}
          />
          <div style={{ marginTop: '0.5em', fontWeight: 'bold' }}>
            {asset.games}
          </div>
          <div style={{ fontSize: '0.9em', color: '#666' }}>
            {asset.description}
          </div>
        </div>
      ))}
    </div>
  )
}
