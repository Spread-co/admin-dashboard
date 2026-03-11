export default {
  editor: {
    label: { en: 'Admin Dashboard' },
    icon: 'bar-chart',
    categories: ['content'],
  },
  properties: {
    supabaseUrl: {
      label: { en: 'Supabase URL' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    supabaseAnonKey: {
      label: { en: 'Supabase Anon Key' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    accessToken: {
      label: { en: 'Auth Token' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    refreshTrigger: {
      label: { en: 'Refresh Trigger' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
  },
  triggerEvents: [
    {
      name: 'admindashboard:loaded',
      label: { en: 'Dashboard Loaded' },
      event: { sections: '' },
    },
    {
      name: 'admindashboard:error',
      label: { en: 'On Error' },
      event: { message: '' },
    },
  ],
};
