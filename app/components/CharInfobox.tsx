'use client'

interface CharInfoboxProps {
  color: string
  corecolor: string
  bordercolor: string
  name: string
  jname: string
  tmname: string
  slogan?: string
  image: string
  size?: string
  caption: string
  gender: string
  age?: string
  years?: string
  colors?: string
  eyes?: string
  hair?: string
  hometown: string
  relatives?: string
  region: string
  trainer?: string
  trainerclass?: string
  game?: string
  generation?: string
  games?: string
  leader?: string
  anime?: string
  epnum?: string
  epname?: string
  enva?: string
  java?: string
  gameanim?: string
  pv?: string
  pvnum?: string
  pvname?: string
  envagame?: string
  javagame?: string
}

export default function CharInfobox({
  color,
  corecolor,
  bordercolor,
  name,
  jname,
  tmname,
  slogan,
  image,
  size = "245px",
  caption,
  gender,
  age,
  years,
  colors,
  eyes,
  hair,
  hometown,
  relatives,
  region,
  trainer,
  trainerclass,
  game,
  generation,
  games,
  leader,
  anime,
  epnum,
  epname,
  enva,
  java,
  gameanim,
  pv,
  pvnum,
  pvname,
  envagame,
  javagame
}: CharInfoboxProps) {
  const infoboxStyle = {
    border: `2px solid #${bordercolor}`,
    backgroundColor: `#${corecolor}`,
  }

  const headerStyle = {
    backgroundColor: `#${color}`,
    borderBottom: `2px solid #${bordercolor}`,
  }

  return (
    <div className="infobox charinfobox text-xs wiki-infobox" style={infoboxStyle}>
      <table className="w-full border-collapse">
        <tbody>
          {/* Header */}
          <tr>
            <th colSpan={2} style={headerStyle}>
              <div className="text-white font-bold text-sm text-center py-1">
                {name}
              </div>
            </th>
          </tr>
          
          {/* Image */}
          <tr>
            <td colSpan={2} className="text-center p-2">
              <img 
                src={image} 
                alt={name}
                className="mx-auto"
                style={{ 
                  width: size ? `${parseInt(size) * 0.8}px` : '196px', 
                  height: 'auto',
                  border: `2px solid #${bordercolor}`,
                  borderRadius: '12px',
                  backgroundColor: `#${corecolor}`
                }}
              />
              <div className="text-[10px] mt-1">
                {caption}
              </div>
            </td>
          </tr>

          {/* Basic Info */}
          <tr>
            <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
              Gender
            </th>
            <td className="px-2 py-1">
              {gender}
            </td>
          </tr>

          {age && (
            <tr>
              <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                Age
              </th>
              <td className="px-2 py-1">
                {years}
              </td>
            </tr>
          )}

          {colors && (
            <>
              {eyes && (
                <tr>
                  <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                    Eyes
                  </th>
                  <td className="px-2 py-1">
                    {eyes}
                  </td>
                </tr>
              )}
              {hair && (
                <tr>
                  <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                    Hair
                  </th>
                  <td className="px-2 py-1">
                    {hair}
                  </td>
                </tr>
              )}
            </>
          )}

          <tr>
            <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
              Hometown
            </th>
            <td className="px-2 py-1">
              <div dangerouslySetInnerHTML={{ __html: hometown }} />
            </td>
          </tr>

          {relatives && (
            <tr>
              <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                Relatives
              </th>
              <td className="px-2 py-1">
                {relatives}
              </td>
            </tr>
          )}

          <tr>
            <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
              Region
            </th>
            <td className="px-2 py-1">
              {region}
            </td>
          </tr>

          {trainer && (
            <tr>
              <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                Trainer Class
              </th>
              <td className="px-2 py-1">
                {trainerclass}
              </td>
            </tr>
          )}

          {game && (
            <>
              <tr>
                <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                  Generation
                </th>
                <td className="px-2 py-1">
                  {generation}
                </td>
              </tr>
              <tr>
                <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                  Games
                </th>
                <td className="px-2 py-1">
                  <div dangerouslySetInnerHTML={{ __html: games || '' }} />
                </td>
              </tr>
            </>
          )}

          {anime && (
            <>
              <tr>
                <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                  Anime Episode
                </th>
                <td className="px-2 py-1">
                  {epnum}: {epname}
                </td>
              </tr>
              <tr>
                <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                  Voice Actors
                </th>
                <td className="px-2 py-1">
                  <div>
                    <span className="font-medium">EN:</span> {enva}<br/>
                    <span className="font-medium">JA:</span> {java}
                  </div>
                </td>
              </tr>
            </>
          )}

          {gameanim && (
            <>
              <tr>
                <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                  Game Animation
                </th>
                <td className="px-2 py-1">
                  {pvnum}: {pvname}
                </td>
              </tr>
              <tr>
                <th className="text-left text-white font-medium px-2 py-1" style={{ backgroundColor: `#${color}` }}>
                  Voice Actors (Game)
                </th>
                <td className="px-2 py-1">
                  <div>
                    <span className="font-medium">EN:</span> {envagame}<br/>
                    <span className="font-medium">JA:</span> {javagame}
                  </div>
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
