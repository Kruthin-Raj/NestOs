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

    // 1. next/link -> react-router-dom Link
    if (content.includes("from 'next/link'") || content.includes('from "next/link"')) {
      content = content.replace(/import Link from ['"]next\/link['"]/g, "import { Link } from 'react-router-dom'")
      content = content.replace(/<Link\s+href=/g, "<Link to=")
    }

    // 2. next/navigation -> react-router-dom hooks
    if (content.includes("from 'next/navigation'") || content.includes('from "next/navigation"')) {
      // Find what's imported from next/navigation
      let hooks = []
      if (content.includes('useRouter')) hooks.push('useNavigate')
      if (content.includes('usePathname')) hooks.push('useLocation')
      if (content.includes('useParams')) hooks.push('useParams')
      if (content.includes('useSearchParams')) hooks.push('useSearchParams')
      
      content = content.replace(/import\s+{([^}]+)}\s+from\s+['"]next\/navigation['"]/g, `import { ${hooks.join(', ')} } from 'react-router-dom'`)
      
      // Replace router usage
      if (content.includes('useRouter')) {
        content = content.replace(/const router\s*=\s*useRouter\(\)/g, "const navigate = useNavigate()")
        content = content.replace(/router\.push\(([^)]+)\)/g, "navigate($1)")
        content = content.replace(/router\.replace\(([^)]+)\)/g, "navigate($1, { replace: true })")
        content = content.replace(/router\.back\(\)/g, "navigate(-1)")
        content = content.replace(/router\.refresh\(\)/g, "window.location.reload()")
      }

      // Replace pathname usage
      if (content.includes('usePathname')) {
        content = content.replace(/const pathname\s*=\s*usePathname\(\)/g, "const location = useLocation()\n  const pathname = location.pathname")
      }
    }

    if (content !== original) {
      fs.writeFileSync(filePath, content)
      console.log('Updated:', filePath)
    }
  }
})
