export interface CityOption {
  name: string
  state: string
  popular?: boolean
}

export const INDIAN_CITIES: CityOption[] = [
  // Top Metro & Tech Hubs
  { name: 'Hyderabad', state: 'Telangana', popular: true },
  { name: 'Bengaluru', state: 'Karnataka', popular: true },
  { name: 'Mumbai', state: 'Maharashtra', popular: true },
  { name: 'Pune', state: 'Maharashtra', popular: true },
  { name: 'Chennai', state: 'Tamil Nadu', popular: true },
  { name: 'Delhi NCR', state: 'Delhi', popular: true },
  { name: 'New Delhi', state: 'Delhi', popular: true },
  { name: 'Noida', state: 'Uttar Pradesh', popular: true },
  { name: 'Gurugram', state: 'Haryana', popular: true },
  { name: 'Kolkata', state: 'West Bengal', popular: true },
  { name: 'Ahmedabad', state: 'Gujarat', popular: true },
  { name: 'Jaipur', state: 'Rajasthan', popular: true },

  // Andhra Pradesh & Telangana
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', popular: true },
  { name: 'Vijayawada', state: 'Andhra Pradesh', popular: true },
  { name: 'Guntur', state: 'Andhra Pradesh' },
  { name: 'Tirupati', state: 'Andhra Pradesh' },
  { name: 'Kakinada', state: 'Andhra Pradesh' },
  { name: 'Nellore', state: 'Andhra Pradesh' },
  { name: 'Kurnool', state: 'Andhra Pradesh' },
  { name: 'Warangal', state: 'Telangana' },
  { name: 'Nizamabad', state: 'Telangana' },
  { name: 'Karimnagar', state: 'Telangana' },
  { name: 'Khammam', state: 'Telangana' },

  // Karnataka & South
  { name: 'Mysuru', state: 'Karnataka' },
  { name: 'Mangaluru', state: 'Karnataka' },
  { name: 'Hubballi', state: 'Karnataka' },
  { name: 'Belagavi', state: 'Karnataka' },
  { name: 'Kochi', state: 'Kerala', popular: true },
  { name: 'Thiruvananthapuram', state: 'Kerala' },
  { name: 'Kozhikode', state: 'Kerala' },
  { name: 'Coimbatore', state: 'Tamil Nadu', popular: true },
  { name: 'Madurai', state: 'Tamil Nadu' },
  { name: 'Tiruchirappalli', state: 'Tamil Nadu' },
  { name: 'Salem', state: 'Tamil Nadu' },
  { name: 'Puducherry', state: 'Puducherry' },

  // Maharashtra & West
  { name: 'Nagpur', state: 'Maharashtra' },
  { name: 'Nashik', state: 'Maharashtra' },
  { name: 'Thane', state: 'Maharashtra' },
  { name: 'Navi Mumbai', state: 'Maharashtra' },
  { name: 'Aurangabad (Chhatrapati Sambhajinagar)', state: 'Maharashtra' },
  { name: 'Surat', state: 'Gujarat' },
  { name: 'Vadodara', state: 'Gujarat' },
  { name: 'Rajkot', state: 'Gujarat' },
  { name: 'Goa (Panaji)', state: 'Goa' },

  // North & Central
  { name: 'Chandigarh', state: 'Punjab', popular: true },
  { name: 'Ludhiana', state: 'Punjab' },
  { name: 'Amritsar', state: 'Punjab' },
  { name: 'Dehradun', state: 'Uttarakhand' },
  { name: 'Lucknow', state: 'Uttar Pradesh', popular: true },
  { name: 'Kanpur', state: 'Uttar Pradesh' },
  { name: 'Varanasi', state: 'Uttar Pradesh' },
  { name: 'Agra', state: 'Uttar Pradesh' },
  { name: 'Ghaziabad', state: 'Uttar Pradesh' },
  { name: 'Prayagraj', state: 'Uttar Pradesh' },
  { name: 'Indore', state: 'Madhya Pradesh', popular: true },
  { name: 'Bhopal', state: 'Madhya Pradesh' },
  { name: 'Gwalior', state: 'Madhya Pradesh' },
  { name: 'Kota', state: 'Rajasthan' },
  { name: 'Udaipur', state: 'Rajasthan' },
  { name: 'Jodhpur', state: 'Rajasthan' },

  // East & North East
  { name: 'Bhubaneswar', state: 'Odisha', popular: true },
  { name: 'Cuttack', state: 'Odisha' },
  { name: 'Rourkela', state: 'Odisha' },
  { name: 'Patna', state: 'Bihar' },
  { name: 'Ranchi', state: 'Jharkhand' },
  { name: 'Jamshedpur', state: 'Jharkhand' },
  { name: 'Raipur', state: 'Chhattisgarh' },
  { name: 'Guwahati', state: 'Assam' },
  { name: 'Shillong', state: 'Meghalaya' },

  // J&K
  { name: 'Jammu', state: 'Jammu and Kashmir' },
  { name: 'Srinagar', state: 'Jammu and Kashmir' },
]

export const POPULAR_CITIES = INDIAN_CITIES.filter((c) => c.popular)

export function lookupStateByCity(cityName: string): string | undefined {
  if (!cityName) return undefined
  const cleaned = cityName.trim().toLowerCase()
  const found = INDIAN_CITIES.find(
    (c) => c.name.toLowerCase() === cleaned
  )
  return found?.state
}
