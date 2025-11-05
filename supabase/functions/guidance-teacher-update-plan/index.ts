// Supabase Edge Function: Rehber Öğretmen Plan Güncelleme
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL') || 'https://jxxtdljuarnxsmqstzyy.supabase.co';
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Service Role Key secret bulunamadı' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header bulunamadı' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Geçersiz token', details: userError?.message }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { plan_id, institution_id, title, description, plan_date, plan_type } = await req.json();
    if (!plan_id || !institution_id || !plan_type) {
      return new Response(JSON.stringify({ error: 'plan_id, institution_id ve plan_type gerekli' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: teacherData, error: teacherError } = await supabaseAdmin.from('teachers').select('id').eq('user_id', user.id).single();
    if (teacherError || !teacherData) {
      return new Response(JSON.stringify({ error: 'Öğretmen bulunamadı' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: institutionCheck } = await supabaseAdmin.from('institutions').select('id').eq('id', institution_id).eq('guidance_teacher_id', teacherData.id).eq('is_active', true).single();
    if (!institutionCheck) {
      return new Response(JSON.stringify({ error: 'Bu kuruma erişim yetkiniz yok veya rehber öğretmen değilsiniz' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tableName = plan_type === 'daily' ? 'student_daily_plans' : 'student_weekly_plans';
    const dateField = plan_type === 'daily' ? 'plan_date' : 'week_start_date';
    
    const updateData: any = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (plan_date) {
      if (plan_type === 'weekly') {
        const planDateObj = new Date(plan_date);
        const weekStart = new Date(planDateObj);
        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
        weekStart.setDate(diff);
        updateData[dateField] = weekStart.toISOString().split('T')[0];
      } else {
        updateData[dateField] = plan_date instanceof Date ? plan_date.toISOString().split('T')[0] : plan_date;
      }
    }

    const { data, error } = await supabaseAdmin.from(tableName).update(updateData).eq('id', plan_id).eq('teacher_id', teacherData.id).select().single();

    if (error) {
      return new Response(JSON.stringify({ error: 'Plan güncellenemedi', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ data, error: null, message: 'Plan başarıyla güncellendi.' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Beklenmeyen hata', details: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

