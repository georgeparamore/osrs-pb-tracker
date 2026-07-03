package com.pbtracker;

import net.runelite.client.config.Config;
import net.runelite.client.config.ConfigGroup;
import net.runelite.client.config.ConfigItem;

@ConfigGroup("pbtracker")
public interface PbTrackerConfig extends Config
{
	@ConfigItem(
		keyName = "apiBaseUrl",
		name = "API base URL",
		description = "Base URL of your PB tracker backend, e.g. http://localhost:3000 or https://pbs.example.com",
		position = 0
	)
	default String apiBaseUrl()
	{
		return "http://localhost:3000";
	}

	@ConfigItem(
		keyName = "autoSync",
		name = "Auto-sync new PBs",
		description = "Automatically send a PB to the server the moment RuneLite records a new one",
		position = 1
	)
	default boolean autoSync()
	{
		return true;
	}

	@ConfigItem(
		keyName = "syncOnLogin",
		name = "Sync all PBs on login",
		description = "Bulk-upload every known PB shortly after logging in",
		position = 2
	)
	default boolean syncOnLogin()
	{
		return true;
	}
}
