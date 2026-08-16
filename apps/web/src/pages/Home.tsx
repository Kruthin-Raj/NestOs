import { Link } from 'react-router-dom'
import { Building2, Users, CreditCard, AlertCircle, Bell, Shield } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium mb-6">
          <Shield className="h-3 w-3" />
          Verified properties only
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
          The professional way to manage{' '}
          <span className="text-indigo-600">PGs & hostels</span>
        </h1>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          NestOS helps property owners manage rooms, collect rent, handle issues,
          and communicate with tenants — all in one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/signup"
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            <Building2 className="h-4 w-4" />
            I'm a property owner
          </Link>
          <Link to="/signup"
            className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            <Users className="h-4 w-4" />
            I'm looking for a PG
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
          Everything you need to manage your property
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: <Building2 className="h-5 w-5 text-indigo-600" />,
              title: 'Multi-property management',
              desc:  'Manage multiple buildings, floors, rooms, and beds from a single dashboard.',
            },
            {
              icon: <CreditCard className="h-5 w-5 text-green-600" />,
              title: 'Rent collection',
              desc:  'Collect rent via UPI. Track dues, send receipts, monitor cash flow.',
            },
            {
              icon: <AlertCircle className="h-5 w-5 text-orange-600" />,
              title: 'Issue tracking',
              desc:  'Tenants report issues. You manage and resolve them with a clear workflow.',
            },
            {
              icon: <Bell className="h-5 w-5 text-blue-600" />,
              title: 'Notice system',
              desc:  'Send announcements to all tenants, a specific building, floor, or room.',
            },
            {
              icon: <Users className="h-5 w-5 text-teal-600" />,
              title: 'Tenant management',
              desc:  'Assign tenants to beds, track move-ins/outs, view payment history.',
            },
            {
              icon: <Shield className="h-5 w-5 text-purple-600" />,
              title: 'Verification & trust',
              desc:  'Owner and tenant ID verification for a safe, trusted platform.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-white dark:bg-gray-50 border border-gray-200 rounded-xl p-5">
              <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-600 py-16 mt-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">
            Ready to modernize your PG management?
          </h2>
          <p className="text-indigo-100 mb-6">
            Join property owners who use NestOS to save time and collect rent reliably.
          </p>
          <Link to="/signup"
            className="inline-flex items-center gap-2 bg-white dark:bg-gray-50 text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
          >
            Get started free
          </Link>
        </div>
      </section>
    </div>
  )
}