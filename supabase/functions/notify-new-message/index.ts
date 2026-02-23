import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const payload = await req.json()
  
  // payload.record contains the new message
  const { conversation_id, sender_id } = payload.record

  // 1. Create a Supabase admin client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 2. Fetch sender details
  const { data: sender } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', sender_id)
    .single()

  // 3. Fetch all members of the conversation (except the sender)
  const { data: members } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversation_id)
    .neq('user_id', sender_id)

  if (!members || members.length === 0) {
    return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
  }

  const userIds = members.map(m => m.user_id)

  // 4. Get push tokens for these users
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .in('user_id', userIds)

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ message: 'No tokens found' }), { status: 200 })
  }

  // 5. Send notifications (Placeholder for FCM/OneSignal logic)
  // For now, we log it. You would insert your FCM fetch call here.
  console.log(`Sending notification to ${tokens.length} devices from ${sender?.display_name}`)
  
  /*
  Example FCM Logic:
  await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY')}`
    },
    body: JSON.stringify({
      registration_ids: tokens.map(t => t.token),
      notification: {
        title: `New Message from ${sender?.display_name}`,
        body: 'Click to view message',
        sound: 'default'
      }
    })
  })
  */

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
