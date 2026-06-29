import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://odgtubiqvxcszsfifjfd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kZ3R1Ymlxdnhjc3pzZmlmamZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NjA5NDksImV4cCI6MjA5NzUzNjk0OX0.qKXx5hsrG5nJu2bfeu6RZeBWKhcpRfY077eygekXy50';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching flows...");
  const { data: flows } = await supabase.from('crm_repetitive_flows').select('*').order('created_at', { ascending: false }).limit(5);
  
  for (let flow of flows) {
    console.log("\nFlow:", flow.name, flow.id);
    const { data: tasks } = await supabase.from('crm_repetitive_tasks').select('*').eq('repetitive_flow_id', flow.id);
    let realCounts = { step0: 0, step1: 0, step2: 0, completed: 0 };
    for (let t of tasks) {
      if (t.completed) realCounts.completed++;
      else if (t.active_step_idx === 0) realCounts.step0++;
      else if (t.active_step_idx === 1) realCounts.step1++;
      else if (t.active_step_idx === 2) realCounts.step2++;
    }
    console.log("Real Counts:", realCounts);
    
    const { data: snaps } = await supabase.from('crm_repetitive_snapshots').select('*').eq('flow_id', flow.id).order('stamp_time', { ascending: false });
    if (snaps && snaps.length > 0) {
      const snap = snaps[0];
      console.log("Latest Snapshot Stamp:", snap.stamp_time);
      const tasksMap = snap.tasks_map || {};
      let snapCounts = { step0: 0, step1: 0, step2: 0, completed: 0 };
      for (let key in tasksMap) {
        let t = tasksMap[key];
        if (t.completed) snapCounts.completed++;
        else if (t.active_step_idx === 0) snapCounts.step0++;
        else if (t.active_step_idx === 1) snapCounts.step1++;
        else if (t.active_step_idx === 2) snapCounts.step2++;
      }
      console.log("Snapshot Counts:", snapCounts);
    } else {
      console.log("No snapshots found.");
    }
  }
}

run();
