'use client'

interface VoiceActor {
  language: string
  name: string
  original?: string
}

interface VoiceActorTableProps {
  color: string
  bordercolor: string
  actors: VoiceActor[]
}

export default function VoiceActorTable({ color, bordercolor, actors }: VoiceActorTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-2 rounded-md" style={{
        borderColor: `#${bordercolor}`,
        backgroundColor: `#${color}`
      }}>
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left text-white font-medium w-1/3" style={{
              backgroundColor: `#${bordercolor}`
            }}>Language</th>
            <th className="px-2 py-1.5 text-left text-white font-medium" style={{
              backgroundColor: `#${bordercolor}`
            }}>Voice Actor</th>
          </tr>
        </thead>
        <tbody>
          {actors.map((actor, index) => (
            <tr key={index}>
              <td className="px-2 py-1.5 bg-white border-b" style={{
                borderColor: `#${bordercolor}`
              }}>
                <strong>{actor.language}</strong>
              </td>
              <td className="px-2 py-1.5 bg-white border-b" style={{
                borderColor: `#${bordercolor}`
              }}>
                {actor.original ? (
                  <div>
                    <span className="block">{actor.name}</span>
                    <em className="block text-[10px] text-gray-600">{actor.original}</em>
                  </div>
                ) : (
                  actor.name
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
