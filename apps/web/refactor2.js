const fs = require('fs')
const path = require('path')

const directoryPath = path.join(__dirname, 'src')

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f)
    let isDirectory = fs.statSync(dirPath).isDirectory()
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f))
  })
}

walk(directoryPath, (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8')
    let original = content

    // Replace href= with to= anywhere inside a <Link> tag (multiline or after other props)
    // We will do a generic replace of href= to to= for any Link component.
    // A simple way is to match `<Link` and then replace the next `href=` with `to=`
    // But since regex for this can be tricky across newlines, let's just do a string replacement on lines that contain Link and href, or just use a regex that handles newlines.
    
    // Replace any href={ or href=" with to= if it's inside a Link component
    // Actually, just replacing \bhref= with to= in lines that have <Link is not enough if multiline.
    
    // Let's do a simple replace of href= with to= ONLY if the file imports Link from react-router-dom
    if (content.includes("from 'react-router-dom'")) {
        // Find all href= and replace with to= (Assuming we aren't using normal <a> tags that need href, or if we are, we might accidentally replace them. Next.js apps usually use <a href> for external links. Let's be careful).
        
        // Better regex: match <Link ... href=... >
        // We can match `<Link` followed by any chars (including newlines) until `href=`, but only up to the closing `>`
        content = content.replace(/(<Link[^>]*?)\bhref=/g, "$1to=")
    }

    // Fix the `undefined` type errors in params
    // `useParams` in React Router returns `string | undefined`, but Next.js `useParams` often assumes `string`.
    // In files where `useParams` is used, we might need to add `as string` or fallback to `""`.
    // But actually we can just leave it if it compiles, let's see what TSC said:
    // src/app/(tenant)/tenant/issues/[issuesId]/page.tsx(25,42): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
    if (content.includes('useParams')) {
        content = content.replace(/params\.buildingId/g, "(params.buildingId || '')")
        content = content.replace(/params\.roomId/g, "(params.roomId || '')")
        content = content.replace(/params\.issuesId/g, "(params.issuesId || '')")
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content)
      console.log('Fixed Link href and params in:', filePath)
    }
  }
})
