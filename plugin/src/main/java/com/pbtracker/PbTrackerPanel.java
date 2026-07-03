package com.pbtracker;

import net.runelite.client.ui.ColorScheme;
import net.runelite.client.ui.PluginPanel;

import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Font;
import java.awt.event.ActionListener;

class PbTrackerPanel extends PluginPanel
{
	private final JLabel statusLabel = new JLabel("Not synced yet");

	PbTrackerPanel(ActionListener onSyncClicked)
	{
		super(false);
		setLayout(new BorderLayout());
		setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

		JLabel title = new JLabel("PB Tracker Sync");
		title.setForeground(Color.WHITE);
		title.setFont(title.getFont().deriveFont(Font.BOLD, 16f));
		title.setAlignmentX(java.awt.Component.LEFT_ALIGNMENT);

		JButton syncButton = new JButton("Sync all PBs now");
		syncButton.setAlignmentX(java.awt.Component.LEFT_ALIGNMENT);
		syncButton.addActionListener(onSyncClicked);

		statusLabel.setForeground(ColorScheme.LIGHT_GRAY_COLOR);
		statusLabel.setBorder(BorderFactory.createEmptyBorder(10, 0, 0, 0));
		statusLabel.setAlignmentX(java.awt.Component.LEFT_ALIGNMENT);

		JPanel content = new JPanel();
		content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
		content.add(title);
		content.add(Box.createVerticalStrut(10));
		content.add(syncButton);
		content.add(statusLabel);

		add(content, BorderLayout.NORTH);
	}

	void setStatus(String text)
	{
		SwingUtilities.invokeLater(() -> statusLabel.setText(text));
	}
}
