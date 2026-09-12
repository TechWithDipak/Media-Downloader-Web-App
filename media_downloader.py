#!/usr/bin/env python3
import sys
import os
import subprocess
import json

CONFIG_FILE = os.path.expanduser("~/.media_downloader_config.json")

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return {}

def save_config(config):
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f)
    except:
        pass

def check_dependencies():
    print("="*60)
    print("                 MEDIA DOWNLOADER")
    print("="*60)
    
    missing = False
    
    try:
        subprocess.run(["yt-dlp", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        print("✓ yt-dlp: installed")
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("✗ yt-dlp: NOT FOUND\n\nInstall it with:\nbrew install yt-dlp")
        missing = True

    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        print("✓ FFmpeg: installed")
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("✗ FFmpeg: NOT FOUND\n\nInstall it with:\nbrew install ffmpeg")
        missing = True

    print("="*60)
    if missing:
        sys.exit(1)

def get_valid_url():
    while True:
        try:
            url = input("\nPaste YouTube / YouTube Music URL:\n> ").strip()
            if not url:
                print("❌ Error: URL cannot be empty. Please try again.")
                continue
            
            print("\nAnalyzing URL...")
            result = subprocess.run(
                ["yt-dlp", "-J", "--flat-playlist", url],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=True
            )
            data = json.loads(result.stdout)
            
            is_playlist = 'entries' in data
            
            if is_playlist:
                print(f"\nPlaylist: {data.get('title', 'Unknown')}")
                print(f"Uploader: {data.get('uploader', 'Unknown')}")
                entries = list(data.get('entries', []))
                print(f"Items: {len(entries)}")
                return url, 'playlist', data, entries
            else:
                print(f"\nTitle: {data.get('title', 'Unknown')}")
                print(f"Uploader: {data.get('uploader', 'Unknown')}")
                duration = data.get('duration', 0)
                mins, secs = divmod(duration, 60)
                print(f"Duration: {mins}:{secs:02d}")
                return url, 'single', data, None
                
        except subprocess.CalledProcessError as e:
            print("\n❌ Error analyzing URL. Make sure it is valid and accessible.")
            print(f"Reason: {e.stderr.strip().splitlines()[-1] if e.stderr else 'Unknown error'}")
            print("Please try entering the URL again.")
        except KeyboardInterrupt:
            print("\n\nOperation cancelled. Returning to URL input. (Press Ctrl+C again to exit)")
            pass

def show_main_menu():
    while True:
        try:
            print("\n" + "="*60)
            print("                     DOWNLOAD MENU")
            print("="*60)
            print("1. 🎵 Single Song → High Quality MP3")
            print("2. 🎵 Single Song → Best Original Audio")
            print("3. 🎥 Single Video → Best Quality MP4")
            print("4. 🎥 Single Video → Up to 4K MP4")
            print("")
            print("5. 🎵 Playlist → High Quality MP3")
            print("6. 🎵 Playlist → Best Original Audio")
            print("7. 🎥 Playlist → Best Quality MP4")
            print("8. 🎥 Playlist → Up to 4K MP4")
            print("")
            print("9. 🔍 Show Available Formats")
            print("10. ⚙️ Custom Format")
            print("")
            print("0. Exit")
            print("="*60)
            
            choice = input("\nEnter your choice:\n> ").strip()
            if choice in [str(i) for i in range(11)]:
                return choice
            print("❌ Invalid choice. Please select a number between 0 and 10.")
        except KeyboardInterrupt:
            print("\n\nOperation cancelled. Returning to main menu.")

def choose_download_location(config):
    while True:
        try:
            print("\nWhere should the files be saved?")
            print("1. Current folder")
            print("2. Downloads folder")
            print("3. Custom folder")
            
            last_dir = config.get("last_dir")
            if last_dir:
                print(f"4. Last used ({last_dir})")
                
            loc_choice = input("> ").strip()
            
            if loc_choice == '1':
                download_dir = os.getcwd()
            elif loc_choice == '2':
                download_dir = os.path.expanduser("~/Downloads")
            elif loc_choice == '3':
                download_dir = input("Enter folder path:\n> ").strip()
                # Clean up potential escaped spaces if dragged from terminal
                download_dir = download_dir.replace('\\ ', ' ')
                # Clean up trailing backslashes manually added
                if download_dir.endswith('\\'):
                    download_dir = download_dir[:-1]
                download_dir = os.path.expanduser(download_dir)
            elif loc_choice == '4' and last_dir:
                download_dir = last_dir
            else:
                print("❌ Invalid choice. Please select 1, 2, 3, or 4.")
                continue

            # Attempt to create if it doesn't exist
            if not os.path.exists(download_dir):
                while True:
                    create = input(f"Folder '{download_dir}' does not exist. Create it? [Y/n] ").strip().lower()
                    if create in ['', 'y', 'yes', 'n', 'no']:
                        break
                    print("❌ Invalid input. Enter Y or n.")
                if create in ['n', 'no']:
                    print("Please enter a different path.")
                    continue
                try:
                    os.makedirs(download_dir)
                except Exception as e:
                    print(f"❌ Error: Could not create directory '{download_dir}'.")
                    print(f"Details: {e}")
                    print("Please enter a different path.")
                    continue

            # Check if writable
            if not os.access(download_dir, os.W_OK):
                print(f"❌ Error: Permission denied. Cannot write to '{download_dir}'.")
                print("Please enter a different path.")
                continue

            print(f"\n✓ Download location:\n{download_dir}")
            config["last_dir"] = download_dir
            save_config(config)
            return download_dir
        except KeyboardInterrupt:
            print("\n\nOperation cancelled. Returning to location selection.")

def show_formats(url):
    print("\nAvailable Formats:")
    subprocess.run(["yt-dlp", "-F", url])

def execute_download(command_args, download_dir):
    while True:
        try:
            print("\nCommand that will be executed:")
            print(" ".join(command_args))
            
            while True:
                start = input("\nStart download? [Y/n] ").strip().lower()
                if start in ['', 'y', 'yes']:
                    start = 'y'
                    break
                elif start in ['n', 'no']:
                    start = 'n'
                    break
                print("❌ Invalid input. Enter Y or n.")
                
            if start == 'n':
                return
                
            print("\nStarting download...\n")
            
            process = subprocess.Popen(
                command_args,
                cwd=download_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            failed = 0
            
            try:
                for line in process.stdout:
                    line = line.strip()
                    if not line:
                        continue
                    
                    if "[download]" in line and "%" in line:
                        print(line.replace("[download]", "Downloading:").strip(), end='\r')
                    elif "Already downloaded and merged" in line or "has already been downloaded" in line:
                        print(f"\n✓ Already exists: {line}")
                    elif "[Merger]" in line or "[ffmpeg]" in line or "[ExtractAudio]" in line:
                        print(f"\nProcessing... {line}")
                    elif "Destination:" in line:
                        print(f"\n{line}")
                    elif "ERROR:" in line:
                        print(f"\n{line}")
                        failed += 1
                    else:
                        pass # suppress other spam for a cleaner UI
                        
                process.wait()
                print("\n")
                
                if process.returncode == 0:
                    print("✓ Completed")
                    print("="*60)
                    print("DOWNLOAD SUMMARY")
                    print("="*60)
                    print("Status: Success")
                    sys.exit(0) # Exit after successful completion
                else:
                    print(f"\nDownload finished with exit code {process.returncode}.")
                    print("="*60)
                    print("DOWNLOAD SUMMARY")
                    print("="*60)
                    if failed > 0:
                        print(f"Status: Completed with some errors ({failed} error messages logged)")
                    else:
                        print("Status: Completed with errors")
                    
                    # Ask to retry
                    while True:
                        retry = input("\nDownload failed. Do you want to retry? [y/N] ").strip().lower()
                        if retry in ['', 'n', 'no']:
                            retry = 'n'
                            break
                        elif retry in ['y', 'yes']:
                            retry = 'y'
                            break
                        print("❌ Invalid input. Enter y or N.")
                        
                    if retry == 'n':
                        sys.exit(0) # Exit if the user decides not to retry
                    
                    print("\nRetrying download...")
                    
            except KeyboardInterrupt:
                process.terminate()
                print("\nDownload cancelled by user.")
                while True:
                    action = input("\nDo you want to (R)etry, or (M)ain menu? [r/M] ").strip().lower()
                    if action in ['', 'm', 'main']:
                        return
                    elif action in ['r', 'retry']:
                        break
                    print("❌ Invalid input. Enter r or M.")
                    
        except KeyboardInterrupt:
            print("\n\nOperation cancelled. Returning to download prompt.")

def choose_playlist_items(entries):
    while True:
        try:
            print("\n" + "="*60)
            print("PLAYLIST ITEMS")
            print("="*60)
            
            for i, entry in enumerate(entries, 1):
                title = entry.get('title', 'Unknown Title')
                print(f"[{i}] {title}")
                
            print("\nEnter item numbers separated by commas (Example: 1,3,5,8)")
            print("A = Select all")
            print("Q = Cancel")
            
            choice = input("> ").strip().upper()
            
            if choice == 'Q':
                return None
            elif choice == 'A':
                return "all"
            else:
                items = []
                valid = True
                for part in choice.split(','):
                    part = part.strip()
                    if not part:
                        continue
                    if part.isdigit():
                        num = int(part)
                        if 1 <= num <= len(entries):
                            items.append(part)
                        else:
                            print(f"❌ Error: Item {num} is out of range.")
                            valid = False
                            break
                    else:
                        print(f"❌ Error: '{part}' is not a valid number.")
                        valid = False
                        break
                
                if not valid or not items:
                    print("❌ Invalid input. Please try again.")
                    continue
                    
                return items
        except KeyboardInterrupt:
            print("\n\nOperation cancelled. Returning to playlist selection.")

def build_command(mode, url, is_playlist, playlist_items=None, custom_format=None):
    cmd = ["yt-dlp", "--no-overwrites", "--continue", "--ignore-errors"]
    
    if is_playlist and playlist_items and playlist_items != "all":
        cmd.extend(["--playlist-items", ",".join(playlist_items)])
        
    if mode == '1' or mode == '5': # High Quality MP3
        cmd.extend(["-x", "--audio-format", "mp3", "--audio-quality", "0", "--embed-metadata", "--embed-thumbnail"])
    elif mode == '2' or mode == '6': # Best Audio
        cmd.extend(["-f", "ba", "--embed-metadata"])
    elif mode == '3' or mode == '7': # Best Quality MP4
        cmd.extend(["-f", "bv*+ba/b", "--merge-output-format", "mp4", "--embed-metadata"])
    elif mode == '4' or mode == '8': # 4K MP4
        cmd.extend(["-f", "bv*[height<=2160]+ba/b[height<=2160]", "--merge-output-format", "mp4", "--embed-metadata"])
    elif mode == '10': # Custom Format
        if not custom_format:
            custom_format = "best"
        cmd.extend(["-f", custom_format])
        
    if is_playlist:
        cmd.extend(["-o", "%(playlist_index)02d - %(title)s.%(ext)s"])
    else:
        cmd.extend(["-o", "%(title)s.%(ext)s"])
        
    cmd.append(url)
    return cmd

def main():
    check_dependencies()
    config = load_config()
    
    # We allow escaping to the very top by KeyboardInterrupts if handled in main
    while True:
        try:
            url, type_info, data, entries = get_valid_url()
            is_playlist = type_info == 'playlist'
            
            while True:
                choice = show_main_menu()
                
                if choice == '0':
                    sys.exit(0)
                    
                elif choice == '9':
                    show_formats(url)
                    continue
                    
                elif choice == '10':
                    show_formats(url)
                    while True:
                        try:
                            custom_format = input("\nEnter format ID (e.g. 140 or 137+140):\n> ").strip()
                            if custom_format:
                                break
                            print("❌ Format ID cannot be empty.")
                        except KeyboardInterrupt:
                            print("\n\nOperation cancelled. Returning to format input.")
                    
                    if is_playlist:
                        items = choose_playlist_items(entries)
                        if not items:
                            continue
                    else:
                        items = None
                        
                    loc = choose_download_location(config)
                    cmd = build_command(choice, url, is_playlist, items, custom_format)
                    execute_download(cmd, loc)
                    
                elif choice in ['1', '2', '3', '4', '5', '6', '7', '8']:
                    if is_playlist:
                        if choice in ['1', '2', '3', '4']:
                            print("\nYou selected a single-item preset for a playlist. Applying it to the playlist.")
                        items = choose_playlist_items(entries)
                        if not items:
                            continue
                    else:
                        if choice in ['5', '6', '7', '8']:
                            print("\nYou selected a playlist preset for a single video. Applying it to the single video.")
                        items = None
                        
                    loc = choose_download_location(config)
                    cmd = build_command(choice, url, is_playlist, items)
                    execute_download(cmd, loc)
                    
        except KeyboardInterrupt:
            print("\n\nProgram terminated by user. Exiting...")
            sys.exit(0)

if __name__ == "__main__":
    main()
