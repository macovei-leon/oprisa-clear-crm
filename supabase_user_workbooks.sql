CREATE TABLE public.user_workbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    data JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_workbooks ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own workbook
CREATE POLICY "Users can view own workbook" ON public.user_workbooks
    FOR SELECT USING (auth.uid() = user_id);

-- Allow users to update their own workbook
CREATE POLICY "Users can update own workbook" ON public.user_workbooks
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to insert their own workbook
CREATE POLICY "Users can insert own workbook" ON public.user_workbooks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow admins to view all workbooks
CREATE POLICY "Admins can view all workbooks" ON public.user_workbooks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Allow admins to update all workbooks
CREATE POLICY "Admins can update all workbooks" ON public.user_workbooks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );
