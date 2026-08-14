import { Link, Outlet } from 'react-router-dom'

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left side — form */}
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="h-8 w-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <span className="text-white font-bold text-xl leading-none">N</span>
            </div>
            <span className="font-bold text-xl text-gray-900 tracking-tight">NestOS</span>
          </Link>
          <Outlet />
        </div>
      </div>
      
      {/* Right side — hero image/graphic (hidden on mobile) */}
      <div className="hidden lg:block relative w-0 flex-1 bg-teal-900">
        <div className="absolute inset-0 h-full w-full object-cover bg-gradient-to-br from-teal-800 to-teal-950 p-12 flex flex-col justify-between">
          <div></div>
          <div className="text-white">
            <h2 className="text-4xl font-bold mb-4 leading-tight">Managing PGs and hostels has never been easier.</h2>
            <p className="text-teal-200 text-lg">Join thousands of owners and tenants experiencing seamless rentals.</p>
          </div>
        </div>
      </div>
    </div>
  )
}