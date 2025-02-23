import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'http://localhost:54321',  // Local Supabase URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'  // Local anon key
)

async function testEmail() {
  const testEmail = 'rdrachir@gmail.com' // Replace with the email you want to test with
  
  console.log('Testing email function...')
  const { data, error } = await supabase.functions.invoke('send-approval-email', {
    body: { email: testEmail }
  })
  
  console.log('Response:', { data, error })
}

testEmail()
