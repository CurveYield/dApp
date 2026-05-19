using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

namespace BalYieldBalancerLauncher
{
    internal static class Program
    {
        private const string Url = "http://127.0.0.1:3017/balyield/pools";

        [STAThread]
        private static void Main()
        {
            string root = AppDomain.CurrentDomain.BaseDirectory;
            string script = Path.Combine(root, "run-bal-dev.ps1");

            if (!File.Exists(script))
            {
                MessageBox.Show("Missing run-bal-dev.ps1 next to this launcher.", "balYIELD");
                return;
            }

            if (!IsReady())
            {
                try
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "powershell.exe",
                        Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"",
                        WorkingDirectory = root,
                        WindowStyle = ProcessWindowStyle.Hidden,
                        UseShellExecute = true
                    });
                }
                catch (Exception error)
                {
                    MessageBox.Show("Could not start balYIELD app: " + error.Message, "balYIELD");
                    return;
                }
            }

            if (!WaitForReady())
            {
                MessageBox.Show("balYIELD app did not start on port 3017. Check balyield-dev.log in the app folder.", "balYIELD");
                return;
            }

            Process.Start(new ProcessStartInfo { FileName = Url, UseShellExecute = true });
        }

        private static bool WaitForReady()
        {
            for (int i = 0; i < 240; i++)
            {
                if (IsReady()) return true;
                Thread.Sleep(500);
            }
            return false;
        }

        private static bool IsReady()
        {
            try
            {
                var request = (HttpWebRequest)WebRequest.Create(Url);
                request.Timeout = 10000;
                using (var response = (HttpWebResponse)request.GetResponse())
                {
                    return (int)response.StatusCode < 500;
                }
            }
            catch
            {
                return false;
            }
        }
    }
}
